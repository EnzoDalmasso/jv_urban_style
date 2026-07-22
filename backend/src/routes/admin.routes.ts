import { Router } from 'express';
import {
  getSummary,
  patchAppointmentDeposit,
  patchAppointmentStatus,
  patchService,
  patchStaff,
  patchSettings,
  postService,
  postStaff,
  postSpecialHours,
  putBusinessHours,
  removeService,
  removeStaff,
  removeSpecialHours
} from '../controllers/admin.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/adminAuth.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);
adminRouter.get('/summary', asyncHandler(getSummary));
adminRouter.patch('/settings', asyncHandler(patchSettings));
adminRouter.post('/services', asyncHandler(postService));
adminRouter.patch('/services/:id', asyncHandler(patchService));
adminRouter.delete('/services/:id', asyncHandler(removeService));
adminRouter.post('/staff', asyncHandler(postStaff));
adminRouter.patch('/staff/:id', asyncHandler(patchStaff));
adminRouter.delete('/staff/:id', asyncHandler(removeStaff));
adminRouter.put('/business-hours', asyncHandler(putBusinessHours));
adminRouter.post('/special-hours', asyncHandler(postSpecialHours));
adminRouter.delete('/special-hours/:id', asyncHandler(removeSpecialHours));
adminRouter.patch('/appointments/:id/deposit', asyncHandler(patchAppointmentDeposit));
adminRouter.patch('/appointments/:id/status', asyncHandler(patchAppointmentStatus));
