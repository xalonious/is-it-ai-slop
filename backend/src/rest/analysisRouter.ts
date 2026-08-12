import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import asyncHandler from '../core/asyncHandler';
import { validateRequest } from '../core/validation';
import { portfolioAnalysisService } from '../service/portfolioAnalysisService';
import { analyzeRequestSchema } from '../validation/analyzeRequestSchema';

const router = Router();

const analysisRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    code: 'RATE_LIMITED',
    message: 'Too many scans from this address. Try again in a few minutes.',
  },
});

router.post(
  '/',
  analysisRateLimiter,
  validateRequest({ body: analyzeRequestSchema }),
  asyncHandler(async (req, res) => {
    const result = await portfolioAnalysisService.analyze(req.body.url);
    res.status(200).json(result);
  }),
);

export default router;
