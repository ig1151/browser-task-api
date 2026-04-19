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
