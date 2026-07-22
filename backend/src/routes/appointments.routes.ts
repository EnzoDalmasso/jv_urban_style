import { Router } from 'express';
import { postAppointment, postCancelAppointment } from '../controllers/appointments.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const appointmentsRouter = Router();

appointmentsRouter.post('/', asyncHandler(postAppointment));
appointmentsRouter.post('/:publicCode/cancel', asyncHandler(postCancelAppointment));
