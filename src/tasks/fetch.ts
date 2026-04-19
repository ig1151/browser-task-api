import axios from 'axios';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function fetchPage(url: string): Promise<string> {
  const res = await axios.get(url, {
    timeout: 12000,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    maxRedirects: 5,
  });
  return res.data as string;
}

export async function searchTavily(query: string, maxResults = 5): Promise<Array<{ title: string; url: string; snippet: string; content?: string }>> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not set');

  const res = await axios.post(
    'https://api.tavily.com/search',
    {
      query,
      max_results: maxResults,
      include_raw_content: false,
      search_depth: 'basic',
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return (res.data.results ?? []).map((r: { title: string; url: string; content?: string; snippet?: string }) => ({
    title: r.title,
    url: r.url,
    snippet: r.content ?? r.snippet ?? '',
  }));
}
