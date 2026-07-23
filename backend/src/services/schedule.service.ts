import { DateTime } from 'luxon';
import { env } from '../config/env.js';
import {
  demoBusinessHours,
  demoSpecialBusinessHours,
  demoStaff
} from '../lib/demoData.js';
import { supabase } from '../lib/supabase.js';
import { HttpError } from '../utils/httpError.js';
import { isMissingSchemaError } from '../utils/supabaseError.js';

type BusinessHourRow = {
  id: number;
  staff_id: string | null;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
};

type SpecialHourRow = {
  id: string;
  staff_id: string | null;
  date: string;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
  reason: string | null;
};

type StaffRow = {
  id: string;
  full_name: string;
  is_active?: boolean;
};

export async function getPublicSchedule() {
  if (!supabase) {
    return {
      timezone: env.BUSINESS_TIMEZONE,
      businessHours: demoBusinessHours,
      specialHours: demoSpecialBusinessHours,
      staff: demoStaff.map((person) => ({ id: person.id, full_name: person.full_name }))
    };
  }

  const today = DateTime.now().setZone(env.BUSINESS_TIMEZONE).toISODate();
  const limit = DateTime.now().setZone(env.BUSINESS_TIMEZONE).plus({ days: 45 }).toISODate();

  if (!today || !limit) {
    throw new HttpError(400, 'Rango de fechas invalido.');
  }

  const [businessHours, specialHours, staff] = await Promise.all([
    getBusinessHours(),
    getSpecialHours(today, limit),
    getStaff()
  ]);

  return {
    timezone: env.BUSINESS_TIMEZONE,
    businessHours,
    specialHours,
    staff
  };
}

async function getBusinessHours() {
  const { data, error } = await supabase!
    .from('business_hours')
    .select('id, staff_id, day_of_week, opens_at, closes_at, is_closed')
    .order('day_of_week', { ascending: true })
    .order('opens_at', { ascending: true })
    .returns<BusinessHourRow[]>();

  if (error) {
    throw new HttpError(502, 'No se pudieron obtener los horarios.', error);
  }

  return data ?? [];
}

async function getSpecialHours(today: string, limit: string) {
  const { data, error } = await supabase!
    .from('special_business_hours')
    .select('id, staff_id, date, opens_at, closes_at, is_closed, reason')
    .gte('date', today)
    .lte('date', limit)
    .order('date', { ascending: true })
    .order('opens_at', { ascending: true })
    .returns<SpecialHourRow[]>();

  if (error) {
    if (isMissingSchemaError(error)) {
      return [];
    }

    throw new HttpError(502, 'No se pudieron obtener feriados o vacaciones.', error);
  }

  return data ?? [];
}

async function getStaff() {
  const { data, error } = await supabase!
    .from('staff')
    .select('id, full_name, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true })
    .returns<StaffRow[]>();

  if (error) {
    throw new HttpError(502, 'No se pudieron obtener profesionales.', error);
  }

  return data ?? [];
}
