export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function extractDDGRedirectUrl(href: string): string {
  try {
    const url = new URL(href, 'https://duckduckgo.com');
    const uddg = url.searchParams.get('uddg');
    if (uddg) return uddg;
  } catch { /* ignore */ }
  return href;
}

function parseLiteHTML(html: string): SearchResult[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const results: SearchResult[] = [];

  // DDG lite uses table rows with result links and snippets
  const links = doc.querySelectorAll('a.result-link');
  if (links.length > 0) {
    links.forEach((anchor) => {
      const rawHref = anchor.getAttribute('href') ?? '';
      const title = anchor.textContent?.trim() ?? '';
      const row = anchor.closest('tr');
      const snippetRow = row?.nextElementSibling;
      const snippet = snippetRow?.querySelector('td.result-snippet')?.textContent?.trim() ?? '';
      results.push({
        title,
        url: extractDDGRedirectUrl(rawHref),
        snippet,
      });
    });
    return results;
  }

  // Fallback: parse all external links that look like results
  const allLinks = doc.querySelectorAll('a[href]');
  allLinks.forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? '';
    const text = anchor.textContent?.trim() ?? '';
    if (!text || !href) return;

    if (href.includes('uddg=')) {
      results.push({
        title: text,
        url: extractDDGRedirectUrl(href),
        snippet: '',
      });
    } else if (
      href.startsWith('http') &&
      !href.includes('duckduckgo.com')
    ) {
      results.push({
        title: text,
        url: href,
        snippet: '',
      });
    }
  });

  return results;
}

/** Check if we're running on the Vite dev server (proxy available) */
function hasDevProxy(): boolean {
  try {
    return (import.meta as any).env?.DEV === true;
  } catch {
    return false;
  }
}

/**
 * Get the DDG proxy URL.
 * In dev mode, uses the Vite proxy.
 * In production, uses the DDG_PROXY_URL from settings or falls back to
 * a Cloudflare Worker URL (deploy worker/ to get one).
 */
function getDDGProxyUrl(): string | null {
  if (hasDevProxy()) return null; // use local Vite proxy
  // Check for a configured proxy URL in localStorage
  try {
    const url = localStorage.getItem('ddg_proxy_url');
    if (url) return url;
  } catch { /* ignore */ }
  return null;
}

async function searchDDGLite(query: string): Promise<SearchResult[]> {
  const proxyUrl = getDDGProxyUrl();

  if (!proxyUrl) {
    // Dev mode: use Vite proxy
    const body = new URLSearchParams({ q: query });
    const resp = await fetch('/ddg-search/lite/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) return [];
    return parseLiteHTML(await resp.text());
  }

  // Production: use Cloudflare Worker proxy
  const body = new URLSearchParams({ q: query });
  const resp = await fetch(`${proxyUrl}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) return [];
  return parseLiteHTML(await resp.text());
}

export async function webSearch(query: string, maxResults = 10): Promise<string> {
  let results: SearchResult[] = [];

  try {
    results = await searchDDGLite(query);
  } catch {
    // ignore
  }

  const unique = new Map<string, SearchResult>();
  for (const r of results) {
    const key = r.url || r.title;
    if (!unique.has(key)) unique.set(key, r);
  }

  const final = [...unique.values()].slice(0, maxResults);

  if (final.length === 0) {
    return `No results found for "${query}". The DuckDuckGo search returned no matches. Try a different query or more specific terms.`;
  }

  const lines = final.map(
    (r, i) =>
      `${i + 1}. ${r.title}${r.url ? `\n   URL: ${r.url}` : ''}\n   ${r.snippet}`,
  );
  return `Search results for "${query}":\n\n${lines.join('\n\n')}`;
}
