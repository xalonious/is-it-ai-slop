import type { Express } from 'express';
import healthRouter from './healthRouter';
import analysisRouter from './analysisRouter';
import { errorHandler } from '../core/errorHandler';

export default function installRest(app: Express) {
  app.use('/api/health', healthRouter);
  app.use('/api/analyze', analysisRouter);
  app.use(errorHandler);
}
