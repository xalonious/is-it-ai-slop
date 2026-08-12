import { ErrorRequestHandler } from 'express';
import ServiceError from './ServiceError';
import { getLogger } from './logging';

const logger = getLogger();

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof ServiceError) {
    switch (err.code) {
      case 'NOT_FOUND':
        res.status(404).json({ code: err.code, message: err.message });
        break;
      case 'VALIDATION_FAILED':
        res.status(400).json({ code: err.code, message: err.message });
        break;
      case 'UNAUTHORIZED':
        res.status(401).json({ code: err.code, message: err.message });
        break;
      case 'FORBIDDEN':
        res.status(403).json({ code: err.code, message: err.message });
        break;
      case 'CONFLICT':
        res.status(409).json({ code: err.code, message: err.message });
        break;
      case 'BLOCKED_URL':
        res.status(400).json({ code: err.code, message: err.message });
        break;
      case 'SCAN_TIMEOUT':
        res.status(504).json({ code: err.code, message: err.message });
        break;
      case 'SITE_UNREACHABLE':
        res.status(502).json({ code: err.code, message: err.message });
        break;
      case 'SERVICE_UNAVAILABLE':
        res.status(503).json({ code: err.code, message: err.message });
        break;
      case 'INTERNAL_SERVER_ERROR':
        res.status(500).json({ code: err.code, message: err.message });
        logger.error(`Internal server error on ${req.method} ${req.originalUrl}: ${err.message}`);
        break;
      default:
        res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error occurred' });
        logger.error(`Unhandled service error on ${req.method} ${req.originalUrl}: ${err.message}`);
    }
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error(`Unexpected error on ${req.method} ${req.originalUrl}: ${message}`);
  res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error occurred' });
};
