import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { runWorkflow, WORKFLOWS } from '../tasks/workflows';
import { logger } from '../logger';

const router = Router();

const workflowSchema = Joi.object({
  workflow: Joi.string().required(),
  input: Joi.object().pattern(Joi.string(), Joi.string()).required(),
});

router.get('/workflows', (_req: Request, res: Response) => {
  res.json({ workflows: WORKFLOWS, count: WORKFLOWS.length });
});

router.post('/run-workflow', async (req: Request, res: Response) => {
  const { error, value } = workflowSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details[0].message });
    return;
  }

  logger.info({ workflow: value.workflow }, 'Workflow started');
  const result = await runWorkflow(value);
  logger.info({ workflow: value.workflow, status: result.status, latency_ms: result.latency_ms }, 'Workflow complete');

  res.json(result);
});

export default router;
