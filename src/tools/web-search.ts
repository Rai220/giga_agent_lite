export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ── Tauri backend detection ──

async function tauriFetchUrl(
  url: string,
  method?: string,
  body?: string,
): Promise<string | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('fetch_url', { url, method, body });
  } catch {
    return null;
  }
}

function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

// ── DDG HTML parsing ──

function extractDDGRedirectUrl(href: string): string {
  try {
    const url = new URL(href, 'https://duckduckgo.com');
    const uddg = url.searchParams.get('uddg');
    if (uddg) return uddg;
  } catch { /* ignore */ }
  return href;
}

function parseHTMLResults(html: string): SearchResult[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const results: SearchResult[] = [];

  doc.querySelectorAll('.result').forEach((el) => {
    const anchor = el.querySelector('.result__a');
    const snippetEl = el.querySelector('.result__snippet');
    if (!anchor) return;
    const rawHref = anchor.getAttribute('href') ?? '';
    results.push({
      title: anchor.textContent?.trim() ?? '',
      url: extractDDGRedirectUrl(rawHref),
      snippet: snippetEl?.textContent?.trim() ?? '',
    });
  });

  // Fallback: DDG Lite uses table-based layout
  if (results.length === 0) {
    doc.querySelectorAll('a.result-link').forEach((a) => {
      results.push({
        title: a.textContent?.trim() ?? '',
        url: a.getAttribute('href') ?? '',
        snippet: '',
      });
    });
  }

  return results;
}

// ── Search strategies ──

async function searchViaTauri(query: string): Promise<SearchResult[]> {
  if (!isTauri()) return [];
  const body = `q=${encodeURIComponent(query)}`;
  const html = await tauriFetchUrl(
    'https://html.duckduckgo.com/html/',
    'POST',
    body,
  );
  if (!html) return [];
  return parseHTMLResults(html);
}

async function searchViaViteProxy(query: string): Promise<SearchResult[]> {
  try {
    const body = new URLSearchParams({ q: query, kl: '' });
    const resp = await fetch('/ddg-search/html/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    return parseHTMLResults(html);
  } catch {
    return [];
  }
}

// ── DDG Instant Answer API via JSONP (limited to knowledge queries) ──

interface DDGApiResponse {
  Abstract: string;
  AbstractText: string;
  AbstractURL: string;
  AbstractSource: string;
  Answer: string;
  Heading: string;
  Redirect: string;
  RelatedTopics: Array<DDGTopic | { Name: string; Topics: DDGTopic[] }>;
  Results: DDGTopic[];
  Definition: string;
  DefinitionURL: string;
  DefinitionSource: string;
}

interface DDGTopic {
  Text: string;
  FirstURL: string;
}

function ddgApiJsonp(query: string): Promise<DDGApiResponse> {
  return new Promise((resolve, reject) => {
    const cbName = `_ddg_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      no_html: '1',
      skip_disambig: '1',
      callback: cbName,
    });

    const script = document.createElement('script');
    script.src = `https://api.duckduckgo.com/?${params.toString()}`;

    const cleanup = () => {
      delete (window as unknown as Record<string, unknown>)[cbName];
      script.remove();
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, 10_000);

    (window as unknown as Record<string, unknown>)[cbName] = (data: DDGApiResponse) => {
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('failed'));
    };

    document.head.appendChild(script);
  });
}

function parseDDGApiResponse(data: DDGApiResponse): SearchResult[] {
  const results: SearchResult[] = [];

  if (data.Redirect) {
    results.push({
      title: 'DuckDuckGo Redirect',
      url: data.Redirect,
      snippet: `Redirects to: ${data.Redirect}`,
    });
  }

  if (data.Abstract && data.AbstractURL) {
    results.push({
      title: data.Heading || data.AbstractSource || 'Summary',
      url: data.AbstractURL,
      snippet: data.AbstractText || data.Abstract,
    });
  }

  if (data.Answer) {
    results.push({ title: 'Direct Answer', url: '', snippet: data.Answer });
  }

  if (data.Definition && data.DefinitionURL) {
    results.push({
      title: `Definition (${data.DefinitionSource || 'source'})`,
      url: data.DefinitionURL,
      snippet: data.Definition,
    });
  }

  for (const item of data.Results ?? []) {
    if (item.Text && item.FirstURL) {
      results.push({
        title: item.Text.split(' - ')[0] ?? item.Text,
        url: item.FirstURL,
        snippet: item.Text,
      });
    }
  }

  for (const item of data.RelatedTopics ?? []) {
    if ('Topics' in item && Array.isArray(item.Topics)) {
      for (const sub of item.Topics) {
        if (sub.Text && sub.FirstURL) {
          results.push({
            title: sub.Text.split(' - ')[0] ?? sub.Text,
            url: sub.FirstURL,
            snippet: sub.Text,
          });
        }
      }
    } else if ('Text' in item && item.Text && item.FirstURL) {
      results.push({
        title: item.Text.split(' - ')[0] ?? item.Text,
        url: item.FirstURL,
        snippet: item.Text,
      });
    }
  }

  return results;
}

async function searchViaJsonp(query: string): Promise<SearchResult[]> {
  try {
    const data = await ddgApiJsonp(query);
    return parseDDGApiResponse(data);
  } catch {
    return [];
  }
}

// ── Public API ──

export async function webSearch(query: string, maxResults = 10): Promise<string> {
  // Tier 1: Full HTML search (Tauri backend or Vite dev proxy)
  let htmlResults: SearchResult[] = [];
  if (isTauri()) {
    htmlResults = await searchViaTauri(query);
  }
  if (htmlResults.length === 0) {
    htmlResults = await searchViaViteProxy(query);
  }

  // Tier 2: DDG Instant Answer API via JSONP (knowledge base — limited)
  const jsonpResults = await searchViaJsonp(query);

  // Deduplicate and merge (HTML results first — they're richer)
  const seenUrls = new Set<string>();
  const combined: SearchResult[] = [];
  for (const r of [...htmlResults, ...jsonpResults]) {
    const key = r.url || r.title;
    if (seenUrls.has(key)) continue;
    seenUrls.add(key);
    combined.push(r);
  }

  const results = combined.slice(0, maxResults);

  if (results.length === 0) {
    return [
      `No results found for "${query}".`,
      'Note: In browser mode, search uses the DuckDuckGo Instant Answer API which only covers encyclopedic/factual queries.',
      'In the Tauri desktop app, full web search is available.',
      'Try rephrasing as a factual question, e.g.: "What is ..." or "Python programming language".',
    ].join('\n');
  }

  const lines = results.map(
    (r, i) =>
      `${i + 1}. ${r.title}${r.url ? `\n   URL: ${r.url}` : ''}\n   ${r.snippet}`,
  );
  return `Search results for "${query}":\n\n${lines.join('\n\n')}`;
}
