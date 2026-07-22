import { Router } from 'express';
import {
  getSummary,
  patchAppointmentStatus,
  patchService,
  patchSettings,
  postSpecialHours,
  putBusinessHours,
  removeSpecialHours
} from '../controllers/admin.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/adminAuth.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);
adminRouter.get('/summary', asyncHandler(getSummary));
adminRouter.patch('/settings', asyncHandler(patchSettings));
adminRouter.patch('/services/:id', asyncHandler(patchService));
adminRouter.put('/business-hours', asyncHandler(putBusinessHours));
adminRouter.post('/special-hours', asyncHandler(postSpecialHours));
adminRouter.delete('/special-hours/:id', asyncHandler(removeSpecialHours));
adminRouter.patch('/appointments/:id/status', asyncHandler(patchAppointmentStatus));
