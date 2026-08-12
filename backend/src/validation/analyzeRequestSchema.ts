import Joi from 'joi';

export const analyzeRequestSchema = Joi.object({
  url: Joi.string().trim().min(3).max(2048).required(),
});