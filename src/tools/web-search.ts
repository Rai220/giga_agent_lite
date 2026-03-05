export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface DDGApiResponse {
  Abstract: string;
  AbstractText: string;
  AbstractURL: string;
  AbstractSource: string;
  Answer: string;
  AnswerType: string;
  Definition: string;
  DefinitionURL: string;
  DefinitionSource: string;
  Heading: string;
  Redirect: string;
  RelatedTopics: Array<DDGTopic | { Name: string; Topics: DDGTopic[] }>;
  Results: DDGTopic[];
}

interface DDGTopic {
  Text: string;
  FirstURL: string;
  Icon?: { URL: string };
  Result?: string;
}

// ── DDG Instant Answer API via JSONP (works everywhere, no CORS proxy needed) ──

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
      reject(new Error('DuckDuckGo API request timed out'));
    }, 10_000);

    (window as unknown as Record<string, unknown>)[cbName] = (data: DDGApiResponse) => {
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('DuckDuckGo API request failed'));
    };

    document.head.appendChild(script);
  });
}

function parseDDGApiResponse(data: DDGApiResponse): SearchResult[] {
  const results: SearchResult[] = [];

  if (data.Abstract && data.AbstractURL) {
    results.push({
      title: data.Heading || data.AbstractSource || 'Summary',
      url: data.AbstractURL,
      snippet: data.AbstractText || data.Abstract,
    });
  }

  if (data.Answer) {
    results.push({
      title: 'Direct Answer',
      url: '',
      snippet: data.Answer,
    });
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

// ── DDG HTML search via Vite dev proxy (only works in dev mode) ──

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

  return results;
}

async function searchViaHTMLProxy(query: string): Promise<SearchResult[]> {
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

// ── Public API ──

export async function webSearch(query: string, maxResults = 10): Promise<string> {
  const settled = await Promise.allSettled([
    ddgApiJsonp(query),
    searchViaHTMLProxy(query),
  ]);

  const apiData = settled[0]?.status === 'fulfilled' ? settled[0].value : null;
  const htmlResults = settled[1]?.status === 'fulfilled' ? settled[1].value : [];

  let apiResults: SearchResult[] = [];
  if (apiData) {
    if (apiData.Redirect) {
      apiResults = [{
        title: `Redirect for "${query}"`,
        url: apiData.Redirect,
        snippet: `DuckDuckGo redirects to: ${apiData.Redirect}`,
      }];
    } else {
      apiResults = parseDDGApiResponse(apiData);
    }
  }

  const seenUrls = new Set<string>();
  const combined: SearchResult[] = [];
  for (const r of [...htmlResults, ...apiResults]) {
    const key = r.url || r.title;
    if (seenUrls.has(key)) continue;
    seenUrls.add(key);
    combined.push(r);
  }

  const results = combined.slice(0, maxResults);

  if (results.length === 0) {
    return `No results found for "${query}". DuckDuckGo Instant Answer API does not cover all queries (e.g. weather, current events). Try a more factual or encyclopedic query.`;
  }

  const lines = results.map(
    (r, i) =>
      `${i + 1}. ${r.title}${r.url ? `\n   URL: ${r.url}` : ''}\n   ${r.snippet}`,
  );
  return `Search results for "${query}":\n\n${lines.join('\n\n')}`;
}
