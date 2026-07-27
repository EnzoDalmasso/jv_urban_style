import { Router } from 'express';
import { getAvailability } from '../controllers/availability.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { rateLimit } from '../middleware/rateLimit.js';

export const availabilityRouter = Router();

availabilityRouter.use(rateLimit({
  keyPrefix: 'availability',
  windowMs: 60 * 1000,
  max: 90
}));
availabilityRouter.get('/', asyncHandler(getAvailability));
