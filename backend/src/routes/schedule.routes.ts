import { Router } from 'express';
import { getSchedule } from '../controllers/schedule.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const scheduleRouter = Router();

scheduleRouter.get('/', asyncHandler(getSchedule));
