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
import { normalizeStaffName } from '../utils/staffNames.js';
import { isMissingSchemaError } from '../utils/supabaseError.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const updateSettingsSchema = z.object({
  cancellationNoticeMinutes: z.coerce.number().int().min(0).optional(),
  depositPercentage: z.coerce.number().min(0).max(100).optional(),
  requireDepositForLateCancellation: z.boolean().optional(),
  transferHolder: z.string().trim().max(120).optional(),
  transferAlias: z.string().trim().max(80).optional(),
  transferCbu: z.string().trim().max(80).optional(),
  whatsappPhone: z.string().trim().max(40).optional()
});

export const updateServiceSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  price: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional()
});

export const createServiceSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().default(45),
  price: z.coerce.number().min(0).default(0)
});

export const updateStaffSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  role: z.string().trim().min(2).optional(),
  isActive: z.boolean().optional()
});

export const createStaffSchema = z.object({
  fullName: z.string().trim().min(2),
  role: z.string().trim().min(2).default('barber')
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

export const updateAppointmentDepositSchema = z.object({
  depositStatus: z.enum(['pending', 'paid', 'waived'])
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
      appointments: demoAppointments,
      upcomingAppointments: []
    };
  }

  const [settings, services, staff, businessHours, specialHours, appointments, upcomingAppointments] = await Promise.all([
    getShopSettings(),
    getServicesForAdmin(),
    getStaffForAdmin(),
    getBusinessHoursForAdmin(),
    getSpecialHoursForAdmin(safeDate),
    getAppointmentsForAdmin(safeDate),
    getUpcomingAppointmentsForAdmin(safeDate)
  ]);

  return { settings, services, staff, businessHours, specialHours, appointments, upcomingAppointments };
}

export async function updateSettings(input: z.infer<typeof updateSettingsSchema>) {
  const parsed = updateSettingsSchema.parse(input);

  Object.assign(demoSettings, {
    cancellation_notice_minutes: parsed.cancellationNoticeMinutes ?? demoSettings.cancellation_notice_minutes,
    deposit_percentage: parsed.depositPercentage ?? demoSettings.deposit_percentage,
    require_deposit_for_late_cancellation:
      parsed.requireDepositForLateCancellation ?? demoSettings.require_deposit_for_late_cancellation,
    transfer_holder: parsed.transferHolder ?? demoSettings.transfer_holder,
    transfer_alias: parsed.transferAlias ?? demoSettings.transfer_alias,
    transfer_cbu: parsed.transferCbu ?? demoSettings.transfer_cbu,
    whatsapp_phone: parsed.whatsappPhone ?? demoSettings.whatsapp_phone
  });

  if (!supabase) {
    return demoSettings;
  }

  const { data, error } = await supabase
    .from('shop_settings')
    .upsert(removeUndefined({
      id: true,
      cancellation_notice_minutes: parsed.cancellationNoticeMinutes,
      deposit_percentage: parsed.depositPercentage,
      require_deposit_for_late_cancellation: parsed.requireDepositForLateCancellation,
      transfer_holder: parsed.transferHolder,
      transfer_alias: parsed.transferAlias,
      transfer_cbu: parsed.transferCbu,
      whatsapp_phone: parsed.whatsappPhone
    }), { onConflict: 'id' })
    .select(`
      cancellation_notice_minutes,
      deposit_percentage,
      require_deposit_for_late_cancellation,
      transfer_holder,
      transfer_alias,
      transfer_cbu,
      whatsapp_phone
    `)
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      throw new HttpError(409, 'Falta ejecutar la migracion SQL del panel admin en Supabase.', error);
    }

    throw new HttpError(502, 'No se pudo guardar la configuración.', error);
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

export async function createService(input: z.infer<typeof createServiceSchema>) {
  const parsed = createServiceSchema.parse(input);

  if (!supabase) {
    const next = {
      id: randomUUID(),
      name: parsed.name,
      description: parsed.description ?? '',
      duration_minutes: parsed.durationMinutes,
      price: parsed.price,
      sort_order: demoServices.length + 1,
      is_active: true
    };
    demoServices.push(next);
    return next;
  }

  const nextSortOrder = await getNextServiceSortOrder();
  const { data: service, error } = await supabase
    .from('services')
    .insert({
      name: parsed.name,
      description: parsed.description ?? null,
      duration_minutes: parsed.durationMinutes,
      price: parsed.price,
      sort_order: nextSortOrder,
      is_active: true
    })
    .select('id, name, description, duration_minutes, price, sort_order, is_active')
    .single();

  if (error || !service) {
    throw new HttpError(502, 'No se pudo agregar el servicio.', error);
  }

  await attachServiceToAllActiveStaff(service.id);
  return service;
}

export async function deactivateService(id: string) {
  const serviceId = z.string().uuid().parse(id);

  if (!supabase) {
    const service = demoServices.find((item) => item.id === serviceId);
    if (service) {
      Object.assign(service, { is_active: false });
    }
    return { id: serviceId, is_active: false };
  }

  const { data, error } = await supabase
    .from('services')
    .update({ is_active: false })
    .eq('id', serviceId)
    .select('id, name, description, duration_minutes, price, sort_order, is_active')
    .single();

  if (error) {
    throw new HttpError(502, 'No se pudo quitar el servicio.', error);
  }

  return data;
}

export async function updateStaff(id: string, input: z.infer<typeof updateStaffSchema>) {
  const staffId = z.string().uuid().parse(id);
  const parsed = updateStaffSchema.parse(input);
  const payload = removeUndefined({
    full_name: parsed.fullName,
    role: parsed.role,
    is_active: parsed.isActive
  });

  if (!supabase) {
    const person = demoStaff.find((item) => item.id === staffId);
    if (!person) {
      throw new HttpError(404, 'Profesional no encontrado.');
    }

    Object.assign(person, payload);
    return person;
  }

  const { data, error } = await supabase
    .from('staff')
    .update(payload)
    .eq('id', staffId)
    .select('id, full_name, role, timezone, is_active')
    .single();

  if (error) {
    throw new HttpError(502, 'No se pudo guardar el profesional.', error);
  }

  return data;
}

export async function createStaff(input: z.infer<typeof createStaffSchema>) {
  const parsed = createStaffSchema.parse(input);

  if (!supabase) {
    const next = {
      id: randomUUID(),
      full_name: parsed.fullName,
      role: parsed.role,
      timezone: env.BUSINESS_TIMEZONE,
      is_active: true
    };
    demoStaff.push(next);
    return next;
  }

  const { data: staff, error } = await supabase
    .from('staff')
    .insert({
      full_name: parsed.fullName,
      role: parsed.role,
      timezone: env.BUSINESS_TIMEZONE,
      is_active: true
    })
    .select('id, full_name, role, timezone, is_active')
    .single();

  if (error || !staff) {
    throw new HttpError(502, 'No se pudo agregar el profesional.', error);
  }

  await attachAllActiveServices(staff.id);
  return staff;
}

export async function deactivateStaff(id: string) {
  const staffId = z.string().uuid().parse(id);

  if (!supabase) {
    const person = demoStaff.find((item) => item.id === staffId);
    if (person) {
      Object.assign(person, { is_active: false });
    }
    return { id: staffId, is_active: false };
  }

  const { data, error } = await supabase
    .from('staff')
    .update({ is_active: false })
    .eq('id', staffId)
    .select('id, full_name, role, timezone, is_active')
    .single();

  if (error) {
    throw new HttpError(502, 'No se pudo quitar el profesional.', error);
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

export async function updateAppointmentDeposit(id: string, input: z.infer<typeof updateAppointmentDepositSchema>) {
  const safeId = z.string().uuid().parse(id);
  const parsed = updateAppointmentDepositSchema.parse(input);
  const nextStatus = parsed.depositStatus === 'pending' ? 'pending' : 'confirmed';

  if (!supabase) {
    return { id: safeId, deposit_status: parsed.depositStatus, status: nextStatus };
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({
      deposit_status: parsed.depositStatus,
      deposit_required: parsed.depositStatus !== 'waived',
      status: nextStatus
    })
    .eq('id', safeId)
    .select('id, deposit_status, deposit_required, status')
    .single();

  if (error) {
    throw new HttpError(502, 'No se pudo actualizar la seña.', error);
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
    .eq('is_active', true)
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
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) {
    throw new HttpError(502, 'No se pudieron obtener los profesionales.', error);
  }

  return dedupeStaffRows(data ?? []);
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

  return (data ?? []).map(mapAppointmentRow);
}

async function getUpcomingAppointmentsForAdmin(date: string) {
  if (!supabase) {
    return [];
  }

  const localDay = DateTime.fromISO(date, { zone: env.BUSINESS_TIMEZONE }).startOf('day');
  const startsAfter = localDay.plus({ days: 1 }).toUTC().toISO();

  if (!startsAfter) {
    throw new HttpError(400, 'Rango de fecha invalido.');
  }

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
    .gte('starts_at', startsAfter)
    .eq('status', 'pending')
    .order('starts_at', { ascending: true })
    .limit(80);

  if (error) {
    if (isMissingSchemaError(error)) {
      throw new HttpError(409, 'Falta ejecutar la migracion SQL del panel admin en Supabase.', error);
    }

    throw new HttpError(502, 'No se pudieron obtener los turnos pendientes.', error);
  }

  return (data ?? []).map(mapAppointmentRow);
}

function mapAppointmentRow(row: any) {
  return {
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
    staffName: row.staff?.full_name ? normalizeStaffName(row.staff.full_name) : 'Sin profesional',
    services: (row.appointment_services ?? []).map((service: any) => ({
      name: service.service_name_at_booking,
      durationMinutes: service.duration_minutes,
      price: Number(service.price_at_booking)
    }))
  };
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

async function attachAllActiveServices(staffId: string) {
  if (!supabase) {
    return;
  }

  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id')
    .eq('is_active', true);

  if (servicesError) {
    throw new HttpError(502, 'No se pudieron asociar servicios al profesional.', servicesError);
  }

  const rows = (services ?? []).map((service) => ({
    staff_id: staffId,
    service_id: service.id
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('staff_services')
    .upsert(rows, { onConflict: 'staff_id,service_id' });

  if (error) {
    throw new HttpError(502, 'No se pudieron asociar servicios al profesional.', error);
  }
}

async function attachServiceToAllActiveStaff(serviceId: string) {
  if (!supabase) {
    return;
  }

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('is_active', true);

  if (staffError) {
    throw new HttpError(502, 'No se pudieron asociar profesionales al servicio.', staffError);
  }

  const rows = (staff ?? []).map((person) => ({
    staff_id: person.id,
    service_id: serviceId
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('staff_services')
    .upsert(rows, { onConflict: 'staff_id,service_id' });

  if (error) {
    throw new HttpError(502, 'No se pudieron asociar profesionales al servicio.', error);
  }
}

async function getNextServiceSortOrder() {
  if (!supabase) {
    return demoServices.length + 1;
  }

  const { data, error } = await supabase
    .from('services')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  if (error) {
    throw new HttpError(502, 'No se pudo calcular el orden del servicio.', error);
  }

  return Number(data?.sort_order ?? 0) + 1;
}

function dedupeStaffRows(staff: Array<{ id: string; full_name: string; role?: string; timezone: string; is_active?: boolean }>) {
  const seen = new Set<string>();
  const result: typeof staff = [];

  for (const person of staff) {
    const displayName = normalizeStaffName(person.full_name);
    const key = displayName.trim().toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      result.push({ ...person, full_name: displayName });
    }
  }

  return result;
}
