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

function extractDDGRedirectUrl(href: string): string {
  try {
    const url = new URL(href, 'https://duckduckgo.com');
    const uddg = url.searchParams.get('uddg');
    if (uddg) return uddg;
  } catch { /* ignore */ }
  return href;
}

function parseLiteResults(html: string): SearchResult[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const results: SearchResult[] = [];

  // Lite DDG uses table-based layout with links in specific table cells
  const links = doc.querySelectorAll('a.result-link');
  if (links.length > 0) {
    links.forEach((anchor) => {
      const rawHref = anchor.getAttribute('href') ?? '';
      const title = anchor.textContent?.trim() ?? '';
      // Find the next sibling td with snippet text
      const row = anchor.closest('tr');
      const snippetRow = row?.nextElementSibling;
      const snippet = snippetRow?.querySelector('td.result-snippet')?.textContent?.trim() ?? '';
      results.push({
        title,
        url: extractDDGRedirectUrl(rawHref),
        snippet,
      });
    });
  }

  // Fallback: parse all links that look like search results
  if (results.length === 0) {
    const allLinks = doc.querySelectorAll('a[href]');
    allLinks.forEach((anchor) => {
      const href = anchor.getAttribute('href') ?? '';
      const text = anchor.textContent?.trim() ?? '';
      if (
        text &&
        href &&
        !href.startsWith('/') &&
        !href.includes('duckduckgo.com') &&
        href.startsWith('http')
      ) {
        results.push({
          title: text,
          url: href,
          snippet: '',
        });
      } else if (text && href && href.includes('uddg=')) {
        results.push({
          title: text,
          url: extractDDGRedirectUrl(href),
          snippet: '',
        });
      }
    });
  }

  return results;
}

async function searchViaAPI(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    no_html: '1',
    skip_disambig: '1',
  });
  const resp = await fetch(`/ddg-api/?${params.toString()}`);
  if (!resp.ok) return [];
  const data = (await resp.json()) as DDGApiResponse;

  if (data.Redirect) {
    return [{
      title: `Redirect for "${query}"`,
      url: data.Redirect,
      snippet: `DuckDuckGo redirects to: ${data.Redirect}`,
    }];
  }

  return parseDDGApiResponse(data);
}

async function searchViaHTML(query: string): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({ q: query });
    const resp = await fetch(`/ddg-search/lite/?${params.toString()}`);
    if (!resp.ok) return [];
    const html = await resp.text();
    return parseLiteResults(html);
  } catch {
    return [];
  }
}

export async function webSearch(query: string, maxResults = 10): Promise<string> {
  const [apiResults, htmlResults] = await Promise.allSettled([
    searchViaAPI(query),
    searchViaHTML(query),
  ]);

  const api = apiResults.status === 'fulfilled' ? apiResults.value : [];
  const html = htmlResults.status === 'fulfilled' ? htmlResults.value : [];

  const seenUrls = new Set<string>();
  const combined: SearchResult[] = [];

  for (const r of [...html, ...api]) {
    const key = r.url || r.title;
    if (seenUrls.has(key)) continue;
    seenUrls.add(key);
    combined.push(r);
  }

  const results = combined.slice(0, maxResults);

  if (results.length === 0) {
    return `No results found for "${query}". The DuckDuckGo search returned no matches. Try a different query or more specific terms.`;
  }

  const lines = results.map(
    (r, i) =>
      `${i + 1}. ${r.title}${r.url ? `\n   URL: ${r.url}` : ''}\n   ${r.snippet}`,
  );
  return `Search results for "${query}":\n\n${lines.join('\n\n')}`;
}
