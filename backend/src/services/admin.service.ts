import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  demoAppointments,
  demoBusinessHours,
  demoServices,
  demoSettings,
  demoSpecialBusinessHours,
  demoStaff
} from '../lib/demoData.js';
import { supabase } from '../lib/supabase.js';
import { getShopSettings } from './settings.service.js';
import { HttpError } from '../utils/httpError.js';
import { isMissingSchemaError } from '../utils/supabaseError.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const updateSettingsSchema = z.object({
  cancellationNoticeMinutes: z.coerce.number().int().min(0).optional(),
  depositPercentage: z.coerce.number().min(0).max(100).optional(),
  requireDepositForLateCancellation: z.boolean().optional()
});

export const updateServiceSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  price: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional()
});

export const saveBusinessHoursSchema = z.object({
  staffId: z.string().uuid().nullable().optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  opensAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  closesAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  isClosed: z.boolean()
});

export const saveSpecialHoursSchema = z.object({
  staffId: z.string().uuid().nullable().optional(),
  date: dateSchema,
  opensAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  closesAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  isClosed: z.boolean(),
  reason: z.string().trim().optional().nullable()
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show'])
});

export async function getAdminSummary(date: string) {
  const safeDate = dateSchema.parse(date);

  if (!supabase) {
    return {
      settings: demoSettings,
      services: demoServices,
      staff: demoStaff,
      businessHours: demoBusinessHours,
      specialHours: demoSpecialBusinessHours.filter((item) => item.date === safeDate),
      appointments: demoAppointments
    };
  }

  const [settings, services, staff, businessHours, specialHours, appointments] = await Promise.all([
    getShopSettings(),
    getServicesForAdmin(),
    getStaffForAdmin(),
    getBusinessHoursForAdmin(),
    getSpecialHoursForAdmin(safeDate),
    getAppointmentsForAdmin(safeDate)
  ]);

  return { settings, services, staff, businessHours, specialHours, appointments };
}

export async function updateSettings(input: z.infer<typeof updateSettingsSchema>) {
  const parsed = updateSettingsSchema.parse(input);

  Object.assign(demoSettings, {
    cancellation_notice_minutes: parsed.cancellationNoticeMinutes ?? demoSettings.cancellation_notice_minutes,
    deposit_percentage: parsed.depositPercentage ?? demoSettings.deposit_percentage,
    require_deposit_for_late_cancellation:
      parsed.requireDepositForLateCancellation ?? demoSettings.require_deposit_for_late_cancellation
  });

  if (!supabase) {
    return demoSettings;
  }

  const { data, error } = await supabase
    .from('shop_settings')
    .upsert({
      id: true,
      cancellation_notice_minutes: parsed.cancellationNoticeMinutes,
      deposit_percentage: parsed.depositPercentage,
      require_deposit_for_late_cancellation: parsed.requireDepositForLateCancellation
    }, { onConflict: 'id' })
    .select('cancellation_notice_minutes, deposit_percentage, require_deposit_for_late_cancellation')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      throw new HttpError(409, 'Falta ejecutar la migracion SQL del panel admin en Supabase.', error);
    }

    throw new HttpError(502, 'No se pudo guardar la configuracion.', error);
  }

  return data;
}

export async function updateService(id: string, input: z.infer<typeof updateServiceSchema>) {
  const serviceId = z.string().uuid().parse(id);
  const parsed = updateServiceSchema.parse(input);
  const payload = removeUndefined({
    name: parsed.name,
    description: parsed.description,
    duration_minutes: parsed.durationMinutes,
    price: parsed.price,
    is_active: parsed.isActive
  });

  if (!supabase) {
    const service = demoServices.find((item) => item.id === serviceId);
    if (!service) {
      throw new HttpError(404, 'Servicio no encontrado.');
    }

    Object.assign(service, payload);
    return service;
  }

  const { data, error } = await supabase
    .from('services')
    .update(payload)
    .eq('id', serviceId)
    .select('id, name, description, duration_minutes, price, sort_order, is_active')
    .single();

  if (error) {
    throw new HttpError(502, 'No se pudo guardar el servicio.', error);
  }

  return data;
}

export async function saveBusinessHours(input: z.infer<typeof saveBusinessHoursSchema>) {
  const parsed = saveBusinessHoursSchema.parse(input);
  const payload = {
    staff_id: parsed.staffId ?? null,
    day_of_week: parsed.dayOfWeek,
    opens_at: normalizeTime(parsed.opensAt),
    closes_at: normalizeTime(parsed.closesAt),
    is_closed: parsed.isClosed
  };

  if (!supabase) {
    const existing = demoBusinessHours.find((item) => (
      item.staff_id === payload.staff_id && item.day_of_week === payload.day_of_week
    ));
    if (existing) {
      Object.assign(existing, payload);
      return existing;
    }
    const next = { id: demoBusinessHours.length + 1, ...payload };
    demoBusinessHours.push(next);
    return next;
  }

  const existing = await findBusinessHours(payload.staff_id, payload.day_of_week);
  const query = existing
    ? supabase.from('business_hours').update(payload).eq('id', existing.id)
    : supabase.from('business_hours').insert(payload);

  const { data, error } = await query
    .select('id, staff_id, day_of_week, opens_at, closes_at, is_closed')
    .single();

  if (error) {
    throw new HttpError(502, 'No se pudo guardar el horario.', error);
  }

  return data;
}

export async function saveSpecialHours(input: z.infer<typeof saveSpecialHoursSchema>) {
  const parsed = saveSpecialHoursSchema.parse(input);
  const payload = {
    staff_id: parsed.staffId ?? null,
    date: parsed.date,
    opens_at: normalizeTime(parsed.opensAt),
    closes_at: normalizeTime(parsed.closesAt),
    is_closed: parsed.isClosed,
    reason: parsed.reason || null
  };

  if (!supabase) {
    const existing = demoSpecialBusinessHours.find((item) => (
      item.staff_id === payload.staff_id && item.date === payload.date
    ));
    if (existing) {
      Object.assign(existing, payload);
      return existing;
    }
    const next = { id: randomUUID(), ...payload };
    demoSpecialBusinessHours.push(next);
    return next;
  }

  const existing = await findSpecialHours(payload.staff_id, payload.date);
  const query = existing
    ? supabase.from('special_business_hours').update(payload).eq('id', existing.id)
    : supabase.from('special_business_hours').insert(payload);

  const { data, error } = await query
    .select('id, staff_id, date, opens_at, closes_at, is_closed, reason')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      throw new HttpError(409, 'Falta ejecutar la migracion SQL del panel admin en Supabase.', error);
    }

    throw new HttpError(502, 'No se pudo guardar el horario especial.', error);
  }

  return data;
}

export async function deleteSpecialHours(id: string) {
  const safeId = z.string().uuid().parse(id);

  if (!supabase) {
    const index = demoSpecialBusinessHours.findIndex((item) => item.id === safeId);
    if (index >= 0) {
      demoSpecialBusinessHours.splice(index, 1);
    }
    return { deleted: true };
  }

  const { error } = await supabase
    .from('special_business_hours')
    .delete()
    .eq('id', safeId);

  if (error) {
    throw new HttpError(502, 'No se pudo eliminar el horario especial.', error);
  }

  return { deleted: true };
}

export async function updateAppointmentStatus(id: string, input: z.infer<typeof updateAppointmentStatusSchema>) {
  const safeId = z.string().uuid().parse(id);
  const parsed = updateAppointmentStatusSchema.parse(input);

  if (!supabase) {
    return { id: safeId, status: parsed.status };
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ status: parsed.status })
    .eq('id', safeId)
    .select('id, status')
    .single();

  if (error) {
    throw new HttpError(502, 'No se pudo actualizar el turno.', error);
  }

  return data;
}

async function getServicesForAdmin() {
  if (!supabase) {
    return demoServices;
  }

  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new HttpError(502, 'No se pudieron obtener los servicios.', error);
  }

  return data ?? [];
}

async function getStaffForAdmin() {
  if (!supabase) {
    return demoStaff;
  }

  const { data, error } = await supabase
    .from('staff')
    .select('id, full_name, role, timezone, is_active')
    .order('full_name', { ascending: true });

  if (error) {
    throw new HttpError(502, 'No se pudieron obtener los profesionales.', error);
  }

  return data ?? [];
}

async function getBusinessHoursForAdmin() {
  if (!supabase) {
    return demoBusinessHours;
  }

  const { data, error } = await supabase
    .from('business_hours')
    .select('id, staff_id, day_of_week, opens_at, closes_at, is_closed')
    .order('day_of_week', { ascending: true });

  if (error) {
    throw new HttpError(502, 'No se pudieron obtener los horarios.', error);
  }

  return data ?? [];
}

async function getSpecialHoursForAdmin(date: string) {
  if (!supabase) {
    return demoSpecialBusinessHours.filter((item) => item.date === date);
  }

  const { data, error } = await supabase
    .from('special_business_hours')
    .select('id, staff_id, date, opens_at, closes_at, is_closed, reason')
    .eq('date', date)
    .order('opens_at', { ascending: true });

  if (error) {
    if (isMissingSchemaError(error)) {
      return [];
    }

    throw new HttpError(502, 'No se pudieron obtener horarios especiales.', error);
  }

  return data ?? [];
}

async function getAppointmentsForAdmin(date: string) {
  if (!supabase) {
    return demoAppointments;
  }

  const localDay = DateTime.fromISO(date, { zone: env.BUSINESS_TIMEZONE }).startOf('day');
  const startsAt = localDay.toUTC().toISO();
  const endsAt = localDay.endOf('day').toUTC().toISO();

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      public_code,
      starts_at,
      ends_at,
      status,
      notes,
      total_duration_minutes,
      total_price,
      deposit_required,
      deposit_amount,
      deposit_status,
      clients(first_name, last_name, phone),
      staff(id, full_name),
      appointment_services(service_name_at_booking, duration_minutes, price_at_booking)
    `)
    .gte('starts_at', startsAt)
    .lt('starts_at', endsAt)
    .order('starts_at', { ascending: true });

  if (error) {
    if (isMissingSchemaError(error)) {
      throw new HttpError(409, 'Falta ejecutar la migracion SQL del panel admin en Supabase.', error);
    }

    throw new HttpError(502, 'No se pudieron obtener los turnos.', error);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    publicCode: row.public_code,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    notes: row.notes,
    totalDurationMinutes: row.total_duration_minutes,
    totalPrice: Number(row.total_price),
    depositRequired: row.deposit_required,
    depositAmount: Number(row.deposit_amount),
    depositStatus: row.deposit_status,
    clientName: `${row.clients?.first_name ?? ''} ${row.clients?.last_name ?? ''}`.trim(),
    clientPhone: row.clients?.phone ?? '',
    staffId: row.staff?.id ?? '',
    staffName: row.staff?.full_name ?? 'Sin profesional',
    services: (row.appointment_services ?? []).map((service: any) => ({
      name: service.service_name_at_booking,
      durationMinutes: service.duration_minutes,
      price: Number(service.price_at_booking)
    }))
  }));
}

async function findBusinessHours(staffId: string | null, dayOfWeek: number) {
  if (!supabase) {
    return null;
  }

  let query = supabase
    .from('business_hours')
    .select('id')
    .eq('day_of_week', dayOfWeek);

  query = staffId ? query.eq('staff_id', staffId) : query.is('staff_id', null);

  const { data, error } = await query.maybeSingle<{ id: number }>();

  if (error) {
    throw new HttpError(502, 'No se pudo buscar el horario existente.', error);
  }

  return data;
}

async function findSpecialHours(staffId: string | null, date: string) {
  if (!supabase) {
    return null;
  }

  let query = supabase
    .from('special_business_hours')
    .select('id')
    .eq('date', date);

  query = staffId ? query.eq('staff_id', staffId) : query.is('staff_id', null);

  const { data, error } = await query.maybeSingle<{ id: string }>();

  if (error) {
    throw new HttpError(502, 'No se pudo buscar el horario especial existente.', error);
  }

  return data;
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}
