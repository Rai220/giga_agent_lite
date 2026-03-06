export interface ExecutionResult {
  output: string;
  logs: string[];
  error: boolean;
  imageDataUrl?: string;
}

const CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';

export function executeJs(code: string): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-scripts');
    iframe.style.display = 'none';

    iframe.srcdoc = `<!doctype html>
<canvas id="chart-canvas" width="800" height="400"></canvas>
<script src="${CHART_JS_CDN}"><\/script>
<script>
window.addEventListener('message', async function(e) {
  var logs = [];
  var _log = console.log;
  console.log = function() {
    logs.push(Array.prototype.slice.call(arguments).map(String).join(' '));
  };
  try {
    var canvas = document.getElementById('chart-canvas');
    var ctx = canvas.getContext('2d');
    var fn = new Function('canvas', 'ctx', 'Chart', e.data.code);
    var r = fn(canvas, ctx, typeof Chart !== 'undefined' ? Chart : undefined);
    if (r && typeof r.then === 'function') r = await r;
    // Check if canvas was drawn on
    var imageData = null;
    try {
      var pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      var hasContent = false;
      for (var i = 3; i < pixels.length; i += 4) {
        if (pixels[i] > 0) { hasContent = true; break; }
      }
      if (hasContent) {
        imageData = canvas.toDataURL('image/png');
      }
    } catch(ce) {}
    // If return value is a data URL image, use it
    if (typeof r === 'string' && r.startsWith('data:image/')) {
      imageData = r;
      r = undefined;
    }
    var out = r === undefined ? '' : (typeof r === 'object' ? JSON.stringify(r) : String(r));
    parent.postMessage({ ok: true, result: out, logs: logs, imageDataUrl: imageData }, '*');
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
        imageDataUrl?: string;
      };
      if (data.ok) {
        resolve({
          output: data.result ?? '',
          logs: data.logs,
          error: false,
          imageDataUrl: data.imageDataUrl ?? undefined,
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
