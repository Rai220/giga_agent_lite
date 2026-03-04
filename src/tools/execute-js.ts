export interface ExecutionResult {
  output: string;
  logs: string[];
  error: boolean;
}

export function executeJs(code: string): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-scripts');
    iframe.style.display = 'none';

    iframe.srcdoc = `<!doctype html><script>
window.addEventListener('message', async function(e) {
  var logs = [];
  var _log = console.log;
  console.log = function() {
    logs.push(Array.prototype.slice.call(arguments).map(String).join(' '));
  };
  try {
    var fn = new Function(e.data.code);
        var r = fn();
    if (r && typeof r.then === 'function') r = await r;
    var out = r === undefined ? '' : (typeof r === 'object' ? JSON.stringify(r) : String(r));
    parent.postMessage({ ok: true, result: out, logs: logs }, '*');
  } catch(err) {
    parent.postMessage({ ok: false, error: String(err), logs: logs }, '*');
  }
});
<\/script>`;

    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ output: 'Execution timed out (10 s)', logs: [], error: true });
    }, 10_000);

    function handler(e: MessageEvent): void {
      if (e.source !== iframe.contentWindow) return;
      if (settled) return;
      settled = true;
      cleanup();
      const data = e.data as {
        ok: boolean;
        result?: string;
        error?: string;
        logs: string[];
      };
      if (data.ok) {
        resolve({
          output: data.result ?? '',
          logs: data.logs,
          error: false,
        });
      } else {
        resolve({
          output: data.error ?? 'Unknown error',
          logs: data.logs,
          error: true,
        });
      }
    }

    function cleanup(): void {
      clearTimeout(timer);
      window.removeEventListener('message', handler);
      iframe.remove();
    }

    window.addEventListener('message', handler);
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.postMessage({ code }, '*');
    };
  });
}
