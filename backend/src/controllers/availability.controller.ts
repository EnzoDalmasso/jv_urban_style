import type { Request, Response } from 'express';
import { z } from 'zod';
import { calculateAvailability } from '../services/availability.service.js';

const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().uuid().optional(),
  serviceIds: z.string().optional(),
  staffId: z.string().uuid().optional()
}).refine((data) => data.serviceId || data.serviceIds, {
  message: 'Debe enviarse serviceId o serviceIds.'
});

export async function getAvailability(req: Request, res: Response) {
  const query = availabilityQuerySchema.parse(req.query);
  const serviceIds = query.serviceIds
    ? query.serviceIds.split(',').map((id) => id.trim()).filter(Boolean)
    : [query.serviceId as string];

  const availability = await calculateAvailability({
    date: query.date,
    serviceIds,
    staffId: query.staffId
  });

  res.json(availability);
}
