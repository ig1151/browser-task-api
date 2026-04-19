import { Router, Request, Response } from 'express';
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'browser-task-api',
    version: '1.0.0',
    description: 'Agent-ready browser task API — search, extract and summarize the web with structured JSON output.',
    status: 'ok',
    docs: '/docs',
    health: '/v1/health',
    openapi: '/openapi.json',
    endpoints: {
      run_task: 'POST /v1/browser-task',
      list_tasks: 'GET /v1/tasks',
    },
    example: {
      goal: 'Find the current Bitcoin price and market cap',
      task_type: 'search_and_extract',
      output_schema: {
        price: 'string',
        market_cap: 'string',
        source: 'string',
      },
    },
  });
});

export default router;
