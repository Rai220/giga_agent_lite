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
<script>
var _chartReady = false;
var _pendingCode = null;

function _run(code) {
  var logs = [];
  var _log = console.log;
  console.log = function() {
    logs.push(Array.prototype.slice.call(arguments).map(String).join(' '));
  };

  var canvas = document.getElementById('chart-canvas');
  var ctx = canvas.getContext('2d');

  // Disable Chart.js animations so charts render synchronously
  if (typeof Chart !== 'undefined') {
    Chart.defaults.animation = false;
    Chart.defaults.responsive = false;
  }

  try {
    var fn = new Function('canvas', 'ctx', 'Chart', code);
    var r = fn(canvas, ctx, typeof Chart !== 'undefined' ? Chart : undefined);
    if (r && typeof r.then === 'function') {
      r.then(function(val) { _finish(val, logs, canvas, ctx); })
       .catch(function(err) {
         parent.postMessage({ ok: false, error: String(err), logs: logs }, '*');
       });
      return;
    }
    // Even with animation:false, Chart.js may defer rendering to next frame.
    // Wait briefly to let the chart paint before capturing the canvas.
    setTimeout(function() { _finish(r, logs, canvas, ctx); }, 150);
  } catch(err) {
    parent.postMessage({ ok: false, error: String(err), logs: logs }, '*');
  }
}

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
  } catch(ce) {}

  if (typeof r === 'string' && r.startsWith('data:image/')) {
    imageData = r;
    r = undefined;
  }

  var out = r === undefined ? '' : (typeof r === 'object' ? JSON.stringify(r) : String(r));
  parent.postMessage({ ok: true, result: out, logs: logs, imageDataUrl: imageData }, '*');
}

window.addEventListener('message', function(e) {
  if (_chartReady) {
    _run(e.data.code);
  } else {
    _pendingCode = e.data.code;
  }
});
<\/script>
<script src="${CHART_JS_CDN}"
  onload="_chartReady=true; if(_pendingCode) _run(_pendingCode);"
  onerror="_chartReady=true; if(_pendingCode) _run(_pendingCode);"><\/script>`;

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
