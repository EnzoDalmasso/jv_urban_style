import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  deleteSpecialHours,
  getAdminSummary,
  saveBusinessHours,
  saveSpecialHours,
  updateAppointmentStatus,
  updateService,
  updateStaff,
  updateSettings
} from '../services/admin.service.js';

export async function getSummary(req: Request, res: Response) {
  const query = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }).parse(req.query);

  const summary = await getAdminSummary(query.date);
  res.json(summary);
}

export async function patchSettings(req: Request, res: Response) {
  const settings = await updateSettings(req.body);
  res.json({ settings });
}

export async function patchService(req: Request, res: Response) {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const service = await updateService(params.id, req.body);
  res.json({ service });
}

export async function patchStaff(req: Request, res: Response) {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const staff = await updateStaff(params.id, req.body);
  res.json({ staff });
}

export async function putBusinessHours(req: Request, res: Response) {
  const businessHours = await saveBusinessHours(req.body);
  res.json({ businessHours });
}

export async function postSpecialHours(req: Request, res: Response) {
  const specialHours = await saveSpecialHours(req.body);
  res.status(201).json({ specialHours });
}

export async function removeSpecialHours(req: Request, res: Response) {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const result = await deleteSpecialHours(params.id);
  res.json(result);
}

export async function patchAppointmentStatus(req: Request, res: Response) {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const appointment = await updateAppointmentStatus(params.id, req.body);
  res.json({ appointment });
}
