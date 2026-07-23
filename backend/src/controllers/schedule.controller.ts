import type { Request, Response } from 'express';
import { getPublicSchedule } from '../services/schedule.service.js';

export async function getSchedule(_req: Request, res: Response) {
  const schedule = await getPublicSchedule();
  res.json(schedule);
}
