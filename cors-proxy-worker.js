/**
 * Cloudflare Worker — CORS proxy for GigaChat API.
 *
 * Deploy:
 *   1. Go to https://dash.cloudflare.com → Workers & Pages → Create
 *   2. Click "Create Worker", paste this code, Deploy
 *   3. Copy the worker URL (e.g. https://my-proxy.your-subdomain.workers.dev)
 *   4. Paste it into GigaAgent Lite → Settings → CORS Proxy field
 *
 * Usage: POST https://worker-url/https://gigachat.devices.sberbank.ru/api/v1/token
 *   → proxies to https://gigachat.devices.sberbank.ru/api/v1/token
 */

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);
    const target = url.pathname.slice(1) + url.search;

    if (!target.startsWith('http')) {
      return new Response('Usage: /{target-url}', { status: 400 });
    }

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('origin');
    headers.delete('referer');

    const resp = await fetch(target, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.arrayBuffer() : undefined,
    });

    const response = new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });

    for (const [k, v] of Object.entries(corsHeaders())) {
      response.headers.set(k, v);
    }
    return response;
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}
