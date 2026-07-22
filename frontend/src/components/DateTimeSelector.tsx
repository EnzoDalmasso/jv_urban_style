import { CalendarDays, Clock, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchAvailability } from '../lib/api';
import type { AvailabilitySlot } from '../types';

type DateTimeSelectorProps = {
  serviceIds: string[];
  selectedSlot?: AvailabilitySlot;
  onSelectSlot: (slot: AvailabilitySlot) => void;
};

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateOptions() {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return toISODate(date);
  });
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).format(new Date(`${value}T12:00:00`));
}

export function DateTimeSelector({
  serviceIds,
  selectedSlot,
  onSelectSlot
}: DateTimeSelectorProps) {
  const dates = useMemo(buildDateOptions, []);
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [selectedDate, serviceIds]);

  return (
    <section className="booking-panel" aria-labelledby="booking-date-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Paso 2</p>
          <h2 id="booking-date-title">Elegí fecha y horario</h2>
        </div>
        <CalendarDays aria-hidden="true" />
      </div>

      <div className="date-rail" aria-label="Fechas disponibles">
        {dates.map((date) => (
          <button
            className={date === selectedDate ? 'date-chip active' : 'date-chip'}
            key={date}
            type="button"
            onClick={() => setSelectedDate(date)}
          >
            {formatDayLabel(date)}
          </button>
        ))}
      </div>

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

        {!loading && !error && serviceIds.length > 0 && slots.length === 0 && (
          <p className="muted">No hay horarios libres para esta fecha.</p>
        )}

        {!loading && slots.length > 0 && (
          <div className="slot-grid" aria-label="Horarios disponibles">
            {slots.map((slot) => {
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
