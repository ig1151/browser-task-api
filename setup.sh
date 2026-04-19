#!/bin/bash
set -e

echo "🚀 Setting up Browser Task API..."

mkdir -p src/routes src/tasks

cat > package.json << 'ENDPACKAGE'
{
  "name": "browser-task-api",
  "version": "1.0.0",
  "description": "Agent-ready browser task API — search, extract and summarize the web with structured output.",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "cheerio": "^1.0.0",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "joi": "^17.11.0"
  },
  "devDependencies": {
    "@types/cheerio": "^0.22.35",
    "@types/compression": "^1.7.5",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.2"
  }
}
ENDPACKAGE

cat > tsconfig.json << 'ENDTSCONFIG'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
ENDTSCONFIG

cat > render.yaml << 'ENDRENDER'
services:
  - type: web
    name: browser-task-api
    env: node
    buildCommand: npm install && npm run build
    startCommand: node dist/index.js
    healthCheckPath: /v1/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: ANTHROPIC_API_KEY
        sync: false
ENDRENDER

cat > .gitignore << 'ENDGITIGNORE'
node_modules/
dist/
.env
*.log
ENDGITIGNORE

cat > src/logger.ts << 'ENDLOGGER'
export const logger = {
  info: (obj: unknown, msg?: string) =>
    console.log(JSON.stringify({ level: 'info', ...(typeof obj === 'object' ? obj : { data: obj }), msg })),
  warn: (obj: unknown, msg?: string) =>
    console.warn(JSON.stringify({ level: 'warn', ...(typeof obj === 'object' ? obj : { data: obj }), msg })),
  error: (obj: unknown, msg?: string) =>
    console.error(JSON.stringify({ level: 'error', ...(typeof obj === 'object' ? obj : { data: obj }), msg })),
};
ENDLOGGER

cat > src/types.ts << 'ENDTYPES'
export type TaskType = 'search_and_extract' | 'visit_and_summarize' | 'extract_table';

export interface OutputSchema {
  [key: string]: string | string[];
}

export interface BrowserTaskRequest {
  goal: string;
  task_type: TaskType;
  url?: string;
  query?: string;
  output_schema?: OutputSchema;
  max_results?: number;
}

export interface BrowserTaskResult {
  status: 'success' | 'error';
  task_type: TaskType;
  goal: string;
  result: unknown;
  trace: string[];
  latency_ms: number;
  timestamp: string;
}
ENDTYPES

cat > src/tasks/fetch.ts << 'ENDFETCH'
import axios from 'axios';

const USER_AGENT = 'Mozilla/5.0 (compatible; BrowserTaskBot/1.0)';

export async function fetchPage(url: string): Promise<string> {
  const res = await axios.get(url, {
    timeout: 12000,
    headers: { 'User-Agent': USER_AGENT },
    maxRedirects: 5,
  });
  return res.data as string;
}

export async function searchDuckDuckGo(query: string, maxResults = 5): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const res = await axios.get('https://html.duckduckgo.com/html/', {
    params: { q: query },
    headers: { 'User-Agent': USER_AGENT },
    timeout: 10000,
  });

  const cheerio = await import('cheerio');
  const $ = cheerio.load(res.data as string);
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  $('.result').slice(0, maxResults).each((_i, el) => {
    const title = $(el).find('.result__title').text().trim();
    const href = $(el).find('.result__url').text().trim();
    const snippet = $(el).find('.result__snippet').text().trim();
    if (title && href) {
      results.push({
        title,
        url: href.startsWith('http') ? href : `https://${href}`,
        snippet,
      });
    }
  });

  return results;
}
ENDFETCH

cat > src/tasks/extract.ts << 'ENDEXTRACT'
import * as cheerio from 'cheerio';

export function extractText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, aside, iframe, noscript').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return text.slice(0, 8000);
}

export function extractTables(html: string): Array<{ headers: string[]; rows: string[][] }> {
  const $ = cheerio.load(html);
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];

  $('table').slice(0, 5).each((_i, table) => {
    const headers: string[] = [];
    const rows: string[][] = [];

    $(table).find('th').each((_j, th) => {
      headers.push($(th).text().trim());
    });

    $(table).find('tr').each((_j, tr) => {
      const cells: string[] = [];
      $(tr).find('td').each((_k, td) => {
        cells.push($(td).text().trim());
      });
      if (cells.length > 0) rows.push(cells);
    });

    if (rows.length > 0) tables.push({ headers, rows });
  });

  return tables;
}

export function extractMeta(html: string): { title: string; description: string } {
  const $ = cheerio.load(html);
  return {
    title: $('title').text().trim() || $('h1').first().text().trim(),
    description: $('meta[name="description"]').attr('content') || '',
  };
}
ENDEXTRACT

cat > src/tasks/claude.ts << 'ENDCLAUDE'
import axios from 'axios';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export async function claudeExtract(
  text: string,
  goal: string,
  outputSchema?: Record<string, string | string[]>
): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const schemaInstructions = outputSchema
    ? `Return a JSON object with exactly these fields: ${JSON.stringify(outputSchema)}. Only return valid JSON, no markdown.`
    : 'Return a JSON object with the most relevant structured data extracted. Only return valid JSON, no markdown.';

  const prompt = `You are a web data extraction agent.

Goal: ${goal}

${schemaInstructions}

Page content:
${text}`;

  const res = await axios.post(
    ANTHROPIC_API,
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const content = res.data.content[0]?.text ?? '{}';
  try {
    return JSON.parse(content.replace(/```json|```/g, '').trim());
  } catch {
    return { raw: content };
  }
}

export async function claudeSummarize(text: string, goal: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await axios.post(
    ANTHROPIC_API,
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Summarize the following page content in relation to this goal: "${goal}"\n\nContent:\n${text}\n\nReturn a concise, factual summary in 3-5 sentences.`,
        },
      ],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return res.data.content[0]?.text ?? '';
}
ENDCLAUDE

cat > src/tasks/runner.ts << 'ENDRUNNER'
import { BrowserTaskRequest, BrowserTaskResult } from '../types';
import { fetchPage, searchDuckDuckGo } from './fetch';
import { extractText, extractTables, extractMeta } from './extract';
import { claudeExtract, claudeSummarize } from './claude';

export async function runTask(req: BrowserTaskRequest): Promise<BrowserTaskResult> {
  const start = Date.now();
  const trace: string[] = [];

  try {
    if (req.task_type === 'search_and_extract') {
      const query = req.query || req.goal;
      trace.push(`Searching web for: "${query}"`);

      const results = await searchDuckDuckGo(query, req.max_results ?? 3);
      trace.push(`Found ${results.length} results`);

      if (results.length === 0) {
        return { status: 'error', task_type: req.task_type, goal: req.goal, result: null, trace, latency_ms: Date.now() - start, timestamp: new Date().toISOString() };
      }

      const topResult = results[0];
      trace.push(`Opening top result: ${topResult.url}`);

      let html: string;
      try {
        html = await fetchPage(topResult.url);
        trace.push('Page fetched successfully');
      } catch {
        trace.push('Could not fetch page — using search snippets');
        const snippetText = results.map(r => `${r.title}: ${r.snippet}`).join('\n');
        const extracted = await claudeExtract(snippetText, req.goal, req.output_schema);
        trace.push('Extracted structured data from snippets');
        return {
          status: 'success',
          task_type: req.task_type,
          goal: req.goal,
          result: { extracted, search_results: results },
          trace,
          latency_ms: Date.now() - start,
          timestamp: new Date().toISOString(),
        };
      }

      const text = extractText(html);
      const meta = extractMeta(html);
      trace.push(`Extracted text from page: "${meta.title}"`);

      const extracted = await claudeExtract(text, req.goal, req.output_schema);
      trace.push('Structured data extracted');

      return {
        status: 'success',
        task_type: req.task_type,
        goal: req.goal,
        result: { extracted, source: { url: topResult.url, title: meta.title }, search_results: results },
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
ENDRUNNER

cat > src/routes/task.ts << 'ENDTASK'
import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { runTask } from '../tasks/runner';
import { logger } from '../logger';

const router = Router();

const taskSchema = Joi.object({
  goal: Joi.string().min(5).max(500).required(),
  task_type: Joi.string().valid('search_and_extract', 'visit_and_summarize', 'extract_table').required(),
  url: Joi.string().uri().optional(),
  query: Joi.string().max(200).optional(),
  output_schema: Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string()))).optional(),
  max_results: Joi.number().integer().min(1).max(10).default(3),
});

const taskTypes = [
  {
    name: 'search_and_extract',
    description: 'Search the web for a goal and extract structured data from the top result',
    required: ['goal', 'task_type'],
    optional: ['query', 'output_schema', 'max_results'],
  },
  {
    name: 'visit_and_summarize',
    description: 'Visit a URL and return a goal-focused summary',
    required: ['goal', 'task_type', 'url'],
    optional: [],
  },
  {
    name: 'extract_table',
    description: 'Visit a URL and extract all tables as structured data',
    required: ['goal', 'task_type', 'url'],
    optional: [],
  },
];

router.get('/tasks', (_req: Request, res: Response) => {
  res.json({ task_types: taskTypes, count: taskTypes.length });
});

router.post('/browser-task', async (req: Request, res: Response) => {
  const { error, value } = taskSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details[0].message });
    return;
  }

  logger.info({ task_type: value.task_type, goal: value.goal }, 'Task started');

  const result = await runTask(value);

  logger.info({ task_type: value.task_type, status: result.status, latency_ms: result.latency_ms }, 'Task complete');

  res.json(result);
});

export default router;
ENDTASK

cat > src/routes/docs.ts << 'ENDDOCS'
import { Router, Request, Response } from 'express';
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Browser Task API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; background: #0f0f0f; color: #e0e0e0; }
    h1 { color: #7c3aed; } h2 { color: #a78bfa; border-bottom: 1px solid #333; padding-bottom: 8px; }
    pre { background: #1a1a1a; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
    code { color: #c084fc; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; margin-right: 8px; color: white; }
    .get { background: #065f46; } .post { background: #7c3aed; }
    table { width: 100%; border-collapse: collapse; } td, th { padding: 8px 12px; border: 1px solid #333; text-align: left; }
    th { background: #1a1a1a; }
  </style>
</head>
<body>
  <h1>Browser Task API</h1>
  <p>Agent-ready browser task API — search, extract and summarize the web with structured output.</p>
  <h2>Endpoints</h2>
  <table>
    <tr><th>Method</th><th>Path</th><th>Description</th></tr>
    <tr><td><span class="badge post">POST</span></td><td>/v1/browser-task</td><td>Run a browser task</td></tr>
    <tr><td><span class="badge get">GET</span></td><td>/v1/tasks</td><td>List supported task types</td></tr>
    <tr><td><span class="badge get">GET</span></td><td>/v1/health</td><td>Health check</td></tr>
  </table>
  <h2>search_and_extract</h2>
  <pre>POST /v1/browser-task
{
  "goal": "Find the latest BTC ETF approval article and extract key facts",
  "task_type": "search_and_extract",
  "output_schema": {
    "headline": "string",
    "source": "string",
    "published_at": "string",
    "facts": ["string"]
  }
}</pre>
  <h2>visit_and_summarize</h2>
  <pre>POST /v1/browser-task
{
  "goal": "What are the main risks mentioned on this page?",
  "task_type": "visit_and_summarize",
  "url": "https://example.com/article"
}</pre>
  <h2>extract_table</h2>
  <pre>POST /v1/browser-task
{
  "goal": "Extract pricing table",
  "task_type": "extract_table",
  "url": "https://example.com/pricing"
}</pre>
  <p><a href="/openapi.json" style="color:#a78bfa">OpenAPI JSON</a></p>
</body>
</html>`);
});

export default router;
ENDDOCS

cat > src/routes/openapi.ts << 'ENDOPENAPI'
import { Router, Request, Response } from 'express';
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'Browser Task API',
      version: '1.0.0',
      description: 'Agent-ready browser task API — search, extract and summarize the web with structured output.',
    },
    servers: [{ url: 'https://browser-task-api.onrender.com' }],
    paths: {
      '/v1/browser-task': {
        post: {
          summary: 'Run a browser task',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['goal', 'task_type'],
                  properties: {
                    goal: { type: 'string' },
                    task_type: { type: 'string', enum: ['search_and_extract', 'visit_and_summarize', 'extract_table'] },
                    url: { type: 'string', format: 'uri' },
                    query: { type: 'string' },
                    output_schema: { type: 'object' },
                    max_results: { type: 'integer', default: 3 },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Task result with trace' } },
        },
      },
      '/v1/tasks': {
        get: { summary: 'List supported task types', responses: { '200': { description: 'Task types' } } },
      },
      '/v1/health': {
        get: { summary: 'Health check', responses: { '200': { description: 'OK' } } },
      },
    },
  });
});

export default router;
ENDOPENAPI

cat > src/index.ts << 'ENDINDEX'
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { logger } from './logger';
import taskRouter from './routes/task';
import docsRouter from './routes/docs';
import openapiRouter from './routes/openapi';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false }));

app.get('/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'browser-task-api', timestamp: new Date().toISOString() });
});

app.use('/v1', taskRouter);
app.use('/docs', docsRouter);
app.use('/openapi.json', openapiRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Browser Task API running');
});
ENDINDEX

echo "✅ All files created!"
echo "Next: npm install && npm run dev"