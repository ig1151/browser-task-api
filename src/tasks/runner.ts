import { BrowserTaskRequest, BrowserTaskResult } from '../types';
import { fetchPage, searchTavily } from './fetch';
import { extractText, extractTables, extractMeta } from './extract';
import { claudeExtract, claudeSummarize } from './claude';

export async function runTask(req: BrowserTaskRequest): Promise<BrowserTaskResult> {
  const start = Date.now();
  const trace: string[] = [];

  try {
    if (req.task_type === 'search_and_extract') {
      const query = req.query || req.goal;
      trace.push(`Searching web for: "${query}"`);

      const results = await searchTavily(query, req.max_results ?? 3);
      trace.push(`Found ${results.length} results`);

      if (results.length === 0) {
        return {
          status: 'error',
          task_type: req.task_type,
          goal: req.goal,
          result: null,
          trace,
          latency_ms: Date.now() - start,
          timestamp: new Date().toISOString(),
        };
      }

      const topResult = results[0];
      trace.push(`Opening top result: ${topResult.url}`);

      let pageText = '';
      try {
        const html = await fetchPage(topResult.url);
        pageText = extractText(html);
        const meta = extractMeta(html);
        trace.push(`Extracted text from page: "${meta.title}"`);
      } catch {
        trace.push('Could not fetch page — using search snippets');
      }

      // Fall back to snippets if page text is too short
      const textToExtract = pageText.length > 200
        ? pageText
        : results.map(r => `${r.title}: ${r.snippet}`).join('\n');

      if (pageText.length <= 200) {
        trace.push('Page content thin — extracting from search snippets');
      }

      const extracted = await claudeExtract(textToExtract, req.goal, req.output_schema);
      trace.push('Structured data extracted');

      return {
        status: 'success',
        task_type: req.task_type,
        goal: req.goal,
        result: { extracted, source: { url: topResult.url, title: topResult.title }, search_results: results },
        trace,
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }

    if (req.task_type === 'visit_and_summarize') {
      if (!req.url) throw new Error('url is required for visit_and_summarize');
      trace.push(`Visiting: ${req.url}`);

      const html = await fetchPage(req.url);
      trace.push('Page fetched successfully');

      const text = extractText(html);
      const meta = extractMeta(html);
      trace.push(`Extracted text from: "${meta.title}"`);

      const summary = await claudeSummarize(text, req.goal);
      trace.push('Page summarized');

      return {
        status: 'success',
        task_type: req.task_type,
        goal: req.goal,
        result: { summary, title: meta.title, description: meta.description, url: req.url },
        trace,
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }

    if (req.task_type === 'extract_table') {
      if (!req.url) throw new Error('url is required for extract_table');
      trace.push(`Visiting: ${req.url}`);

      const html = await fetchPage(req.url);
      trace.push('Page fetched successfully');

      const tables = extractTables(html);
      const meta = extractMeta(html);
      trace.push(`Found ${tables.length} table(s) on page`);

      return {
        status: 'success',
        task_type: req.task_type,
        goal: req.goal,
        result: { tables, title: meta.title, url: req.url, table_count: tables.length },
        trace,
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }

    throw new Error(`Unknown task_type: ${req.task_type}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    trace.push(`Error: ${message}`);
    return {
      status: 'error',
      task_type: req.task_type,
      goal: req.goal,
      result: { error: message },
      trace,
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}
