import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { logger } from './logger';
import taskRouter from './routes/task';
import workflowRouter from './routes/workflow';
import docsRouter from './routes/docs';
import openapiRouter from './routes/openapi';
import rootRouter from './routes/root';

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

app.use('/', rootRouter);
app.use('/v1', taskRouter);
app.use('/v1', workflowRouter);
app.use('/docs', docsRouter);
app.use('/openapi.json', openapiRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Browser Task API running');
});
