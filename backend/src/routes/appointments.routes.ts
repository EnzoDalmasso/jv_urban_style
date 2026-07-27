import { Router } from 'express';
import { postAppointment, postCancelAppointment } from '../controllers/appointments.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { rateLimit } from '../middleware/rateLimit.js';

export const appointmentsRouter = Router();

appointmentsRouter.use(rateLimit({
  keyPrefix: 'appointments',
  windowMs: 15 * 60 * 1000,
  max: 30
}));
appointmentsRouter.post('/', asyncHandler(postAppointment));
appointmentsRouter.post('/:publicCode/cancel', asyncHandler(postCancelAppointment));
