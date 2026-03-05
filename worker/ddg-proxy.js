/**
 * Cloudflare Worker: CORS proxy for DuckDuckGo Lite search.
 *
 * Deploy:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. cd worker && wrangler deploy
 *
 * Usage:
 *   POST /search  body: q=<query>
 *   Returns HTML from lite.duckduckgo.com with CORS headers.
 */

const ALLOWED_ORIGINS = ['*']; // restrict to your domain in production

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] === '*' ? '*' : origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);

    if (url.pathname === '/search') {
      let query = '';

      if (request.method === 'POST') {
        const formData = await request.text();
        const params = new URLSearchParams(formData);
        query = params.get('q') || '';
      } else {
        query = url.searchParams.get('q') || '';
      }

      if (!query) {
        return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
          status: 400,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        });
      }

      const ddgResp = await fetch('https://lite.duckduckgo.com/lite/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: new URLSearchParams({ q: query }).toString(),
      });

      const html = await ddgResp.text();
      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('DDG Search Proxy. POST /search with q=<query>', {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'text/plain' },
    });
  },
};
