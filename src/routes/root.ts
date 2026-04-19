import { Router, Request, Response } from 'express';
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'browser-task-api',
    version: '1.1.0',
    description: 'Agent-ready browser task API — run outcome-based workflows and extract structured data from the web.',
    status: 'ok',
    docs: '/docs',
    health: '/v1/health',
    openapi: '/openapi.json',
    endpoints: {
      run_workflow: 'POST /v1/run-workflow',
      list_workflows: 'GET /v1/workflows',
      run_task: 'POST /v1/browser-task',
      list_tasks: 'GET /v1/tasks',
    },
    example: {
      workflow: 'price_tracker',
      input: { asset: 'Bitcoin' },
    },
  });
});

export default router;
