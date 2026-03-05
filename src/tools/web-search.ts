export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ── DuckDuckGo Instant Answer API (CORS-enabled) ──

interface DDGApiResponse {
  Abstract: string;
  AbstractText: string;
  AbstractURL: string;
  AbstractSource: string;
  Answer: string;
  Heading: string;
  Redirect: string;
  Definition: string;
  DefinitionURL: string;
  DefinitionSource: string;
  RelatedTopics: Array<DDGTopic | { Name: string; Topics: DDGTopic[] }>;
  Results: DDGTopic[];
}

interface DDGTopic {
  Text: string;
  FirstURL: string;
}

function parseDDGResponse(data: DDGApiResponse): SearchResult[] {
  const results: SearchResult[] = [];

  if (data.Redirect) {
    results.push({
      title: `Redirect`,
      url: data.Redirect,
      snippet: `DuckDuckGo redirects to: ${data.Redirect}`,
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

async function searchDDG(query: string): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      no_html: '1',
      skip_disambig: '1',
    });
    const resp = await fetch(`https://api.duckduckgo.com/?${params}`);
    if (!resp.ok) return [];
    const data = (await resp.json()) as DDGApiResponse;
    return parseDDGResponse(data);
  } catch {
    return [];
  }
}

// ── Wikipedia Search API (CORS-enabled) ──

interface WikiSearchResult {
  title: string;
  pageid: number;
  snippet: string;
}

interface WikiSearchResponse {
  query?: {
    search: WikiSearchResult[];
  };
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function searchWikipedia(query: string, lang = 'en'): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      format: 'json',
      srlimit: '5',
      origin: '*',
    });
    const resp = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`);
    if (!resp.ok) return [];
    const data = (await resp.json()) as WikiSearchResponse;

    return (data.query?.search ?? []).map((item) => ({
      title: item.title,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
      snippet: stripHtmlTags(item.snippet),
    }));
  } catch {
    return [];
  }
}

/** Detect if query is likely Russian */
function isRussian(text: string): boolean {
  return /[а-яёА-ЯЁ]/.test(text);
}

// ── Combined search ──

export async function webSearch(query: string, maxResults = 10): Promise<string> {
  // Run DDG + Wikipedia in parallel
  // For Russian queries, also search Russian Wikipedia
  const searches: Promise<SearchResult[]>[] = [
    searchDDG(query),
    searchWikipedia(query, 'en'),
  ];
  if (isRussian(query)) {
    searches.push(searchWikipedia(query, 'ru'));
  }

  const settled = await Promise.allSettled(searches);
  const allResults: SearchResult[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') allResults.push(...s.value);
  }

  // Deduplicate
  const unique = new Map<string, SearchResult>();
  for (const r of allResults) {
    const key = r.url || r.title;
    if (!unique.has(key)) unique.set(key, r);
  }

  const final = [...unique.values()].slice(0, maxResults);

  if (final.length === 0) {
    return `No results found for "${query}". Try rephrasing your query in English or using more specific terms.`;
  }

  const lines = final.map(
    (r, i) =>
      `${i + 1}. ${r.title}${r.url ? `\n   URL: ${r.url}` : ''}\n   ${r.snippet}`,
  );
  return `Search results for "${query}":\n\n${lines.join('\n\n')}`;
}
