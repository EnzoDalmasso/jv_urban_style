import type { Request, Response } from 'express';
import { z } from 'zod';
import { cancelAppointment, createAppointment } from '../services/appointments.service.js';

export async function postAppointment(req: Request, res: Response) {
  const appointment = await createAppointment(req.body);
  res.status(201).json(appointment);
}

export async function postCancelAppointment(req: Request, res: Response) {
  const params = z.object({ publicCode: z.string().min(4) }).parse(req.params);
  const result = await cancelAppointment(params.publicCode);
  res.json(result);
}

