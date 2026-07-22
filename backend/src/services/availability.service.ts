import { DateTime, Interval } from 'luxon';
import { z } from 'zod';
import { env } from '../config/env.js';
import { demoServices, demoStaff } from '../lib/demoData.js';
import { supabase } from '../lib/supabase.js';
import { HttpError } from '../utils/httpError.js';
import { isMissingSchemaError } from '../utils/supabaseError.js';

const uuidSchema = z.string().uuid();

type CalculateAvailabilityInput = {
  date: string;
  serviceIds: string[];
  staffId?: string;
};

export type ServiceRow = {
  id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price: number | string;
  sort_order?: number;
  is_active?: boolean;
};

type StaffRow = {
  id: string;
  full_name: string;
  timezone: string;
};

type BusinessHoursRow = {
  staff_id: string | null;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
};

type SpecialBusinessHoursRow = {
  id: string;
  staff_id: string | null;
  date: string;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
  reason: string | null;
};

type BusyRow = {
  staff_id: string;
  starts_at: string;
  ends_at: string;
};

type BusyInterval = {
  interval: Interval;
  reason: 'Reservado' | 'No disponible';
};

export type Slot = {
  time: string;
  startsAt: string;
  endsAt: string;
  staffId: string;
  staffName: string;
  isAvailable: boolean;
  reason?: string;
};

export async function calculateAvailability(input: CalculateAvailabilityInput) {
  const serviceIds = input.serviceIds.map((id) => uuidSchema.parse(id));
  const staffId = input.staffId ? uuidSchema.parse(input.staffId) : undefined;
  const zone = env.BUSINESS_TIMEZONE;
  const localDay = DateTime.fromISO(input.date, { zone }).startOf('day');

  if (!localDay.isValid) {
    throw new HttpError(400, 'Fecha invalida.');
  }

  const dayStartUtc = localDay.toUTC();
  const dayEndUtc = localDay.endOf('day').toUTC();
  const dayOfWeek = localDay.weekday % 7;

  const services = await getActiveServicesByIds(serviceIds);
  const durationMinutes = services.reduce(
    (sum, service) => sum + Number(service.duration_minutes),
    0
  );

  if (!supabase) {
    return calculateDemoAvailability({
      date: input.date,
      durationMinutes,
      staffId,
      zone,
      dayOfWeek
    });
  }

  const staff = await getAvailableStaff(serviceIds, staffId);

  if (staff.length === 0) {
    return {
      date: input.date,
      timezone: zone,
      serviceDurationMinutes: durationMinutes,
      slots: []
    };
  }

  const staffIds = staff.map((person) => person.id);
  const [weeklyHours, specialHours, appointments, timeOff] = await Promise.all([
    getBusinessHours(dayOfWeek, staffIds),
    getSpecialBusinessHours(input.date, staffIds),
    getAppointments(dayStartUtc.toISO(), dayEndUtc.toISO(), staffIds),
    getTimeOff(dayStartUtc.toISO(), dayEndUtc.toISO(), staffIds)
  ]);

  const slots = staff.flatMap((person) => {
    const workingHours = pickWorkingHours(weeklyHours, specialHours, person.id);

    if (!workingHours || workingHours.is_closed) {
      return [];
    }

    const personZone = person.timezone || zone;
    const opensAt = localTimeToDateTime(input.date, workingHours.opens_at, personZone);
    const closesAt = localTimeToDateTime(input.date, workingHours.closes_at, personZone);
    const busyIntervals = toBusyIntervals({
      appointments: appointments.filter((item) => item.staff_id === person.id),
      timeOff: timeOff.filter((item) => item.staff_id === person.id)
    });

    return buildSlots({
      opensAt,
      closesAt,
      durationMinutes,
      intervalMinutes: env.SLOT_INTERVAL_MINUTES,
      busyIntervals,
      staff: person
    });
  });

  return {
    date: input.date,
    timezone: zone,
    serviceDurationMinutes: durationMinutes,
    slots: slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  };
}

export async function getActiveServicesByIds(serviceIds: string[]) {
  if (!supabase) {
    const services = demoServices.filter((service) => serviceIds.includes(service.id));

    if (services.length !== serviceIds.length) {
      throw new HttpError(404, 'Uno o mas servicios no existen o no estan activos.');
    }

    return services;
  }

  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price, sort_order, is_active')
    .in('id', serviceIds)
    .eq('is_active', true)
    .returns<ServiceRow[]>();

  if (error) {
    throw new HttpError(502, 'No se pudieron validar los servicios.', error);
  }

  if (!data || data.length !== serviceIds.length) {
    throw new HttpError(404, 'Uno o mas servicios no existen o no estan activos.');
  }

  return data;
}

function calculateDemoAvailability(params: {
  date: string;
  durationMinutes: number;
  staffId?: string;
  zone: string;
  dayOfWeek: number;
}) {
  const staff = params.staffId
    ? demoStaff.filter((person) => person.id === params.staffId)
    : demoStaff;

  if (params.dayOfWeek === 0 || staff.length === 0) {
    return {
      date: params.date,
      timezone: params.zone,
      serviceDurationMinutes: params.durationMinutes,
      slots: []
    };
  }

  const demoBusyIntervals: BusyInterval[] = [
    {
      interval: Interval.fromDateTimes(
        localTimeToDateTime(params.date, '13:00:00', params.zone).toUTC(),
        localTimeToDateTime(params.date, '14:00:00', params.zone).toUTC()
      ),
      reason: 'Reservado'
    }
  ];

  const slots = staff.flatMap((person) => buildSlots({
    opensAt: localTimeToDateTime(params.date, '10:00:00', person.timezone),
    closesAt: localTimeToDateTime(params.date, '19:00:00', person.timezone),
    durationMinutes: params.durationMinutes,
    intervalMinutes: env.SLOT_INTERVAL_MINUTES,
    busyIntervals: demoBusyIntervals,
    staff: person
  }));

  return {
    date: params.date,
    timezone: params.zone,
    serviceDurationMinutes: params.durationMinutes,
    slots: slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  };
}

async function getAvailableStaff(serviceIds: string[], staffId?: string) {
  if (!supabase) {
    throw new HttpError(500, 'Supabase no esta configurado.');
  }

  let staffServicesQuery = supabase
    .from('staff_services')
    .select('staff_id')
    .in('service_id', serviceIds);

  if (staffId) {
    staffServicesQuery = staffServicesQuery.eq('staff_id', staffId);
  }

  const { data: staffServices, error: staffServicesError } = await staffServicesQuery;

  if (staffServicesError) {
    throw new HttpError(502, 'No se pudieron validar los profesionales.', staffServicesError);
  }

  const countsByStaff = new Map<string, number>();
  for (const row of staffServices ?? []) {
    countsByStaff.set(row.staff_id, (countsByStaff.get(row.staff_id) ?? 0) + 1);
  }

  const eligibleStaffIds = [...countsByStaff.entries()]
    .filter(([, count]) => count === serviceIds.length)
    .map(([id]) => id);

  if (eligibleStaffIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('staff')
    .select('id, full_name, timezone')
    .in('id', eligibleStaffIds)
    .eq('is_active', true)
    .order('full_name', { ascending: true })
    .returns<StaffRow[]>();

  if (error) {
    throw new HttpError(502, 'No se pudieron obtener los profesionales.', error);
  }

  return data ?? [];
}

async function getBusinessHours(dayOfWeek: number, staffIds: string[]) {
  if (!supabase) {
    throw new HttpError(500, 'Supabase no esta configurado.');
  }

  const { data, error } = await supabase
    .from('business_hours')
    .select('staff_id, day_of_week, opens_at, closes_at, is_closed')
    .eq('day_of_week', dayOfWeek)
    .or(`staff_id.is.null,staff_id.in.(${staffIds.join(',')})`)
    .returns<BusinessHoursRow[]>();

  if (error) {
    throw new HttpError(502, 'No se pudieron obtener los horarios laborales.', error);
  }

  return data ?? [];
}

async function getSpecialBusinessHours(date: string, staffIds: string[]) {
  if (!supabase) {
    throw new HttpError(500, 'Supabase no esta configurado.');
  }

  const { data, error } = await supabase
    .from('special_business_hours')
    .select('id, staff_id, date, opens_at, closes_at, is_closed, reason')
    .eq('date', date)
    .or(`staff_id.is.null,staff_id.in.(${staffIds.join(',')})`)
    .returns<SpecialBusinessHoursRow[]>();

  if (error) {
    if (isMissingSchemaError(error)) {
      return [];
    }

    throw new HttpError(502, 'No se pudieron obtener horarios especiales.', error);
  }

  return data ?? [];
}

async function getAppointments(dayStartIso: string | null, dayEndIso: string | null, staffIds: string[]) {
  if (!supabase) {
    throw new HttpError(500, 'Supabase no esta configurado.');
  }

  if (!dayStartIso || !dayEndIso) {
    throw new HttpError(400, 'Rango de fecha invalido.');
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('staff_id, starts_at, ends_at')
    .in('staff_id', staffIds)
    .in('status', ['pending', 'confirmed'])
    .lt('starts_at', dayEndIso)
    .gt('ends_at', dayStartIso)
    .returns<BusyRow[]>();

  if (error) {
    throw new HttpError(502, 'No se pudieron obtener los turnos existentes.', error);
  }

  return data ?? [];
}

async function getTimeOff(dayStartIso: string | null, dayEndIso: string | null, staffIds: string[]) {
  if (!supabase) {
    throw new HttpError(500, 'Supabase no esta configurado.');
  }

  if (!dayStartIso || !dayEndIso) {
    throw new HttpError(400, 'Rango de fecha invalido.');
  }

  const { data, error } = await supabase
    .from('time_off')
    .select('staff_id, starts_at, ends_at')
    .in('staff_id', staffIds)
    .lt('starts_at', dayEndIso)
    .gt('ends_at', dayStartIso)
    .returns<BusyRow[]>();

  if (error) {
    throw new HttpError(502, 'No se pudieron obtener los bloqueos de agenda.', error);
  }

  return data ?? [];
}

function pickWorkingHours(
  weeklyHours: BusinessHoursRow[],
  specialHours: SpecialBusinessHoursRow[],
  staffId: string
) {
  const special = specialHours.find((row) => row.staff_id === staffId)
    ?? specialHours.find((row) => row.staff_id === null);

  if (special) {
    return special;
  }

  return weeklyHours.find((row) => row.staff_id === staffId)
    ?? weeklyHours.find((row) => row.staff_id === null);
}

function localTimeToDateTime(date: string, time: string, zone: string) {
  const cleanTime = time.length === 5 ? `${time}:00` : time;
  return DateTime.fromISO(`${date}T${cleanTime}`, { zone });
}

function toBusyIntervals(rows: { appointments: BusyRow[]; timeOff: BusyRow[] }) {
  const appointmentIntervals = rows.appointments.map((row) => ({
    interval: Interval.fromDateTimes(DateTime.fromISO(row.starts_at), DateTime.fromISO(row.ends_at)),
    reason: 'Reservado' as const
  }));

  const timeOffIntervals = rows.timeOff.map((row) => ({
    interval: Interval.fromDateTimes(DateTime.fromISO(row.starts_at), DateTime.fromISO(row.ends_at)),
    reason: 'No disponible' as const
  }));

  return [...appointmentIntervals, ...timeOffIntervals]
    .filter((item) => item.interval.isValid);
}

function buildSlots(params: {
  opensAt: DateTime;
  closesAt: DateTime;
  durationMinutes: number;
  intervalMinutes: number;
  busyIntervals: BusyInterval[];
  staff: StaffRow;
}): Slot[] {
  const slots: Slot[] = [];
  let cursor = params.opensAt;

  while (cursor.plus({ minutes: params.durationMinutes }) <= params.closesAt) {
    const slotEnd = cursor.plus({ minutes: params.durationMinutes });
    const slotInterval = Interval.fromDateTimes(cursor.toUTC(), slotEnd.toUTC());
    const busy = params.busyIntervals.find((item) => item.interval.overlaps(slotInterval));
    const startsAt = cursor.toUTC().toISO();
    const endsAt = slotEnd.toUTC().toISO();

    if (startsAt && endsAt) {
      slots.push({
        time: cursor.toFormat('HH:mm'),
        startsAt,
        endsAt,
        staffId: params.staff.id,
        staffName: params.staff.full_name,
        isAvailable: !busy,
        reason: busy?.reason
      });
    }

    cursor = cursor.plus({ minutes: params.intervalMinutes });
  }

  return slots;
}
