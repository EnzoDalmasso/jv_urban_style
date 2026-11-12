import type { BusinessHours, PublicSchedule, SpecialHours } from '../types';

export const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Lunes primero, como se lee un horario de local.
const weekOrder = [1, 2, 3, 4, 5, 6, 0];

export function formatHour(value: string) {
  return value.slice(0, 5);
}

export function formatScheduleDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).format(new Date(`${value}T12:00:00`));
}

export function formatRange(hours: { opens_at: string; closes_at: string }) {
  return `${formatHour(hours.opens_at)} a ${formatHour(hours.closes_at)}`;
}

export function summarizeBusinessHours(hours: BusinessHours[]) {
  const globalHours = hours.filter((hour) => hour.staff_id === null);

  return weekOrder
    .map((day) => globalHours.find((hour) => hour.day_of_week === day))
    .filter((hour): hour is BusinessHours => Boolean(hour))
    .map((hour) => ({
      day: hour.day_of_week,
      label: dayLabels[hour.day_of_week],
      value: hour.is_closed ? 'Cerrado' : formatRange(hour),
      isClosed: hour.is_closed
    }));
}

export function globalSpecialHours(specialHours: SpecialHours[]) {
  return specialHours.filter((hour) => hour.staff_id === null);
}

function toLocalISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function describeToday(schedule: PublicSchedule, now = new Date()) {
  const todayISO = toLocalISODate(now);
  const special = globalSpecialHours(schedule.specialHours).find((hour) => hour.date === todayISO);
  const weekly = schedule.businessHours.find((hour) => hour.staff_id === null && hour.day_of_week === now.getDay());
  const hours = special ?? weekly;

  if (!hours) {
    return null;
  }

  if (hours.is_closed) {
    return special?.reason ? `Hoy cerrado: ${special.reason}` : 'Hoy cerrado';
  }

  return `Hoy de ${formatRange(hours)}`;
}
