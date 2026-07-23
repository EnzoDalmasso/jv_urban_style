import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchAvailability } from '../lib/api';
import type { AvailabilitySlot } from '../types';

type DateTimeSelectorProps = {
  serviceIds: string[];
  selectedSlot?: AvailabilitySlot;
  onSelectSlot: (slot: AvailabilitySlot | undefined) => void;
  refreshToken?: number;
};

const weekdayLabels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildCalendarDays(monthCursor: Date) {
  const firstDay = startOfMonth(monthCursor);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      date,
      iso: toISODate(date),
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === monthCursor.getMonth()
    };
  });
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function formatSelectedDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  }).format(new Date(`${value}T12:00:00`));
}

export function DateTimeSelector({
  serviceIds,
  selectedSlot,
  onSelectSlot,
  refreshToken = 0
}: DateTimeSelectorProps) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const todayISO = useMemo(() => toISODate(currentTime), [currentTime]);
  const currentTimestamp = currentTime.getTime();
  const today = currentTime;
  const currentMonthISO = useMemo(() => toISODate(startOfMonth(today)), [today]);
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(today));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);
  const canGoPrevious = toISODate(startOfMonth(monthCursor)) > currentMonthISO;
  const visibleSlots = useMemo(
    () => slots.filter((slot) => new Date(slot.startsAt).getTime() > currentTimestamp),
    [slots, currentTimestamp]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedDate < todayISO) {
      setSelectedDate(todayISO);
      setMonthCursor(startOfMonth(currentTime));
      onSelectSlot(undefined);
    }
  }, [currentTime, onSelectSlot, selectedDate, todayISO]);

  useEffect(() => {
    if (selectedSlot && new Date(selectedSlot.startsAt).getTime() <= currentTimestamp) {
      onSelectSlot(undefined);
    }
  }, [currentTimestamp, onSelectSlot, selectedSlot]);

  useEffect(() => {
    if (serviceIds.length === 0) {
      setSlots([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchAvailability({ date: selectedDate, serviceIds, signal: controller.signal })
      .then((response) => setSlots(response.slots))
      .catch((err: Error) => {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedDate, serviceIds, refreshToken]);

  function moveMonth(delta: number) {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function selectDate(date: Date, iso: string) {
    if (iso < todayISO) {
      return;
    }

    setSelectedDate(iso);
    setMonthCursor(startOfMonth(date));
    onSelectSlot(undefined);
  }

  return (
    <section className="booking-panel" aria-labelledby="booking-date-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Paso 2</p>
          <h2 id="booking-date-title">Elegí fecha y horario</h2>
        </div>
        <CalendarDays aria-hidden="true" />
      </div>

      <div className="calendar-box" aria-label="Calendario de turnos">
        <div className="calendar-header">
          <button
            className="calendar-nav-button"
            type="button"
            onClick={() => moveMonth(-1)}
            disabled={!canGoPrevious}
            aria-label="Mes anterior"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <strong>{formatMonthLabel(monthCursor)}</strong>
          <button
            className="calendar-nav-button"
            type="button"
            onClick={() => moveMonth(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>

        <div className="calendar-grid">
          {weekdayLabels.map((label) => (
            <span className="calendar-weekday" key={label}>{label}</span>
          ))}

          {calendarDays.map((day) => {
            const isPast = day.iso < todayISO;
            const isSelected = day.iso === selectedDate;
            const className = [
              'calendar-day',
              day.inCurrentMonth ? '' : 'muted-month',
              isSelected ? 'active' : ''
            ].filter(Boolean).join(' ');

            return (
              <button
                className={className}
                key={day.iso}
                type="button"
                disabled={isPast}
                aria-pressed={isSelected}
                aria-label={formatSelectedDate(day.iso)}
                onClick={() => selectDate(day.date, day.iso)}
              >
                {day.day}
              </button>
            );
          })}
        </div>
      </div>

      <p className="selected-date-label">{formatSelectedDate(selectedDate)}</p>

      <div className="slot-area">
        {serviceIds.length === 0 && (
          <p className="muted">Seleccioná al menos un servicio para ver horarios.</p>
        )}

        {loading && (
          <div className="state-row" role="status">
            <Loader2 className="spin" aria-hidden="true" />
            Consultando agenda en tiempo real
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        {!loading && !error && serviceIds.length > 0 && visibleSlots.length === 0 && (
          <p className="muted">No hay horarios libres para esta fecha.</p>
        )}

        {!loading && visibleSlots.length > 0 && (
          <div className="slot-grid" aria-label="Horarios disponibles">
            {visibleSlots.map((slot) => {
              const isSelected = selectedSlot?.startsAt === slot.startsAt
                && selectedSlot.staffId === slot.staffId;

              return (
                <button
                  className={[
                    'slot-button',
                    isSelected ? 'active' : '',
                    slot.isAvailable ? '' : 'disabled'
                  ].filter(Boolean).join(' ')}
                  key={`${slot.startsAt}-${slot.staffId}`}
                  type="button"
                  disabled={!slot.isAvailable}
                  onClick={() => onSelectSlot(slot)}
                >
                  <Clock aria-hidden="true" />
                  <span>{slot.time}</span>
                  <small>{slot.isAvailable ? slot.staffName : (slot.reason ?? 'Reservado')}</small>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
