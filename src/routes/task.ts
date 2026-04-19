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
