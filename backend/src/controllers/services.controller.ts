import type { Request, Response } from 'express';
import { demoServices } from '../lib/demoData.js';
import { supabase } from '../lib/supabase.js';
import { HttpError } from '../utils/httpError.js';

export async function listServices(_req: Request, res: Response) {
  if (!supabase) {
    return res.json({ services: demoServices });
  }

  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new HttpError(502, 'No se pudieron obtener los servicios.', error);
  }

  res.json({ services: data ?? [] });
}
