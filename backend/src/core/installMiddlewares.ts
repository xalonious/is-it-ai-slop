import type { Express } from 'express';
import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { loggingMiddleware } from './loggingMiddleware';

dotenv.config();

export default function installMiddlewares(app: Express) {
  app.use(helmet());

  if(process.env.NODE_ENV === 'development') {
    app.use(loggingMiddleware)
  }
    app.use(express.json({ limit: '16kb' }));
}
