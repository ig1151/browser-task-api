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
