import { Router } from 'express';
import { getAvailability } from '../controllers/availability.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const availabilityRouter = Router();

availabilityRouter.get('/', asyncHandler(getAvailability));
