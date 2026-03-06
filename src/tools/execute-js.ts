// Chart.js source inlined at build time — no CDN dependency in sandbox
import chartJsSource from '../vendor/chart.umd.min.js?raw';

export interface ExecutionResult {
  output: string;
  logs: string[];
  error: boolean;
  imageDataUrl?: string;
}

export function executeJs(code: string): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-scripts');
    iframe.style.display = 'none';

    // Build the srcdoc with Chart.js inlined — no external dependencies
    iframe.srcdoc = `<!doctype html>
<canvas id="chart-canvas" width="800" height="400"></canvas>
<script>${chartJsSource}<\/script>
<script>
// Disable animations so charts render synchronously
if (typeof Chart !== 'undefined') {
  Chart.defaults.animation = false;
  Chart.defaults.responsive = false;
}

window.addEventListener('message', function(e) {
  var logs = [];
  var _log = console.log;
  console.log = function() {
    logs.push(Array.prototype.slice.call(arguments).map(String).join(' '));
  };

  var canvas = document.getElementById('chart-canvas');
  var ctx = canvas.getContext('2d');

  try {
    var fn = new Function('canvas', 'ctx', 'Chart', e.data.code);
    var r = fn(canvas, ctx, typeof Chart !== 'undefined' ? Chart : undefined);

    if (r && typeof r.then === 'function') {
      r.then(function(val) { _finish(val, logs, canvas, ctx); })
       .catch(function(err) {
         parent.postMessage({ ok: false, error: String(err), logs: logs }, '*');
       });
      return;
    }

    // Give Chart.js a frame to paint even with animation:false
    setTimeout(function() { _finish(r, logs, canvas, ctx); }, 200);
  } catch(err) {
    parent.postMessage({ ok: false, error: String(err), logs: logs }, '*');
  }
});

function _finish(r, logs, canvas, ctx) {
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
  } catch(ce) { /* ignore */ }

  // If the code returned a data URL directly, use it
  if (typeof r === 'string' && r.startsWith('data:image/')) {
    imageData = r;
    r = undefined;
  }

  var out = r === undefined ? '' : (typeof r === 'object' ? JSON.stringify(r) : String(r));
  parent.postMessage({ ok: true, result: out, logs: logs, imageDataUrl: imageData }, '*');
}
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
