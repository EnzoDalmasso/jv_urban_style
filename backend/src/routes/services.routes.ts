import { Router } from 'express';
import { listServices } from '../controllers/services.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const servicesRouter = Router();

servicesRouter.get('/', asyncHandler(listServices));
