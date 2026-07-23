import { CalendarClock, CheckCircle2, ChevronDown, Scissors } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import heroImage from '../assets/barbershop-lounge-hero.png';
import { BrandLogo } from '../components/BrandLogo';
import { DateTimeSelector } from '../components/DateTimeSelector';
import { createAppointment, fetchPublicSchedule, fetchServices } from '../lib/api';
import type { AvailabilitySlot, BusinessHours, CreateAppointmentResponse, PublicSchedule, Service } from '../types';

const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
type BookingStep = 1 | 2 | 3;

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(Number(price));
}

function buildWhatsappUrl(phone: string | undefined, message: string) {
  const normalizedPhone = (phone ?? '').replace(/\D/g, '');

  if (!normalizedPhone) {
    return null;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

function formatAppointmentDateTime(value: string | undefined) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatHour(value: string) {
  return value.slice(0, 5);
}

function formatScheduleDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short'
  }).format(new Date(`${value}T12:00:00`));
}

function summarizeBusinessHours(hours: BusinessHours[]) {
  const globalHours = hours
    .filter((hour) => hour.staff_id === null)
    .sort((a, b) => a.day_of_week - b.day_of_week);

  if (globalHours.length === 0) {
    return [];
  }

  return globalHours.map((hour) => ({
    label: dayLabels[hour.day_of_week],
    value: hour.is_closed ? 'Cerrado' : `${formatHour(hour.opens_at)} - ${formatHour(hour.closes_at)}`
  }));
}

export function BookingPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | undefined>();
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<CreateAppointmentResponse['appointment'] | null>(null);
  const [availabilityRefreshToken, setAvailabilityRefreshToken] = useState(0);
  const [schedule, setSchedule] = useState<PublicSchedule | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [openStep, setOpenStep] = useState<BookingStep>(1);
  const transferDetails = confirmation?.transfer ?? {
    holder: 'JV Urban Style Barbería',
    alias: 'JVURBANSTYLE',
    cbu: 'Configurar en admin'
  };
  const proofWhatsappUrl = confirmation?.depositRequired
    ? buildWhatsappUrl(
        confirmation.businessWhatsappPhone,
        'Hola JV Urban Style, ya reservé mi turno. Envío el comprobante de la seña.'
      )
    : null;
  const appointmentRequestWhatsappUrl = confirmation && !confirmation.depositRequired
    ? buildWhatsappUrl(
        confirmation.businessWhatsappPhone,
        `Hola JV Urban Style, ya reservé un turno para el ${formatAppointmentDateTime(confirmation.startsAt)}. Queda pendiente de aceptación del dueño.`
      )
    : null;

  useEffect(() => {
    fetchServices()
      .then((response) => setServices(response.services))
      .finally(() => setLoadingServices(false));

    fetchPublicSchedule()
      .then(setSchedule)
      .catch(() => setSchedule(null));
  }, []);

  const weeklyHours = schedule ? summarizeBusinessHours(schedule.businessHours) : [];
  const specialHours = schedule?.specialHours ?? [];

  function toggleService(serviceId: string) {
    setSelectedSlot(undefined);
    setConfirmation(null);
    setSelectedServiceIds((current) => {
      const next = current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId];

      setOpenStep(next.length > 0 ? 2 : 1);
      return next;
    });
  }

  function selectSlot(slot: AvailabilitySlot | undefined) {
    setSelectedSlot(slot);
    setConfirmation(null);
    setError(null);
    if (slot) {
      setOpenStep(3);
    }
  }

  function startNewBooking() {
    setSelectedSlot(undefined);
    setConfirmation(null);
    setError(null);
    setOpenStep(1);
  }

  function scrollToBooking() {
    document.getElementById('booking')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedSlot) {
      setError('Elegir un horario disponible.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    setSubmitting(true);

    try {
      const response = await createAppointment({
        serviceIds: selectedServiceIds,
        staffId: selectedSlot.staffId,
        startsAt: selectedSlot.startsAt,
        client: {
          firstName: String(formData.get('firstName') ?? ''),
          lastName: String(formData.get('lastName') ?? ''),
          phone: String(formData.get('phone') ?? '')
        }
      });

      setConfirmation(response.appointment);
      setSelectedSlot(undefined);
      setAvailabilityRefreshToken((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear el turno.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="client-shell">
      <section
        className="hero lounge-hero"
        style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 9, 8, 0.94) 0%, rgba(8, 9, 8, 0.72) 42%, rgba(8, 9, 8, 0.12) 100%), url(${heroImage})` }}
      >
        <div className="browser-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <header className="client-nav">
          <BrandLogo compact />
          <button
            className="nav-action"
            type="button"
            aria-expanded={showSchedule}
            onClick={() => setShowSchedule((current) => !current)}
          >
            <CalendarClock aria-hidden="true" />
            Horarios semanales
          </button>
        </header>
        <div className="hero-copy">
          <p className="eyebrow">JV Urban Style</p>
          <h1>Más que un corte.</h1>
          <p>
            Elegí tu servicio, encontrá un horario real y dejá tu turno listo con una experiencia
            premium, simple y sin vueltas.
          </p>
          <div className="hero-actions">
            <button className="primary-cta" type="button" onClick={scrollToBooking}>
              <Scissors aria-hidden="true" />
              Reservar turno
            </button>
          </div>
          {showSchedule && (
            <div className="schedule-popover" role="region" aria-label="Horarios del local">
              <strong>Horarios del local</strong>
              {weeklyHours.length > 0 ? (
                <dl>
                  {weeklyHours.map((hour) => (
                    <div key={hour.label}>
                      <dt>{hour.label}</dt>
                      <dd>{hour.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>Los horarios se muestran al configurarlos en el panel admin.</p>
              )}

              {specialHours.length > 0 && (
                <div className="special-schedule">
                  <span>Feriados o vacaciones</span>
                  {specialHours.slice(0, 4).map((hour) => (
                    <p key={hour.id}>
                      {formatScheduleDate(hour.date)}: {hour.is_closed
                        ? (hour.reason || 'Cerrado')
                        : `${formatHour(hour.opens_at)} - ${formatHour(hour.closes_at)}`}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="booking-layout accordion-layout" id="booking">
        <div className={openStep === 1 ? 'booking-panel accordion-panel open attention-step' : 'booking-panel accordion-panel'} aria-labelledby="services-title">
          <button
            className="accordion-heading"
            type="button"
            aria-expanded={openStep === 1}
            onClick={() => setOpenStep(1)}
          >
            <span>
              <p className="eyebrow">Paso 1</p>
              <h2 id="services-title">Seleccioná servicios</h2>
            </span>
            <span className="accordion-icons">
              <Scissors aria-hidden="true" />
              <ChevronDown aria-hidden="true" />
            </span>
          </button>

          {openStep === 1 && (
            <div className="accordion-content service-grid">
              {loadingServices && <p className="muted">Cargando servicios...</p>}

              {services.map((service) => {
                const active = selectedServiceIds.includes(service.id);

                return (
                  <button
                    className={active ? 'service-card active' : 'service-card'}
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                  >
                    <span className="service-topline">
                      <strong>{service.name}</strong>
                      {active && <CheckCircle2 aria-label="Seleccionado" />}
                    </span>
                    <span>{service.description}</span>
                    <span className="service-meta">
                      {service.duration_minutes} min - {formatPrice(service.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DateTimeSelector
          serviceIds={selectedServiceIds}
          selectedSlot={selectedSlot}
          onSelectSlot={selectSlot}
          refreshToken={availabilityRefreshToken}
          isOpen={openStep === 2}
          isDisabled={selectedServiceIds.length === 0}
          onToggle={() => {
            if (selectedServiceIds.length > 0) {
              setOpenStep(2);
            }
          }}
        />

        <aside className={openStep === 3 ? 'summary-panel accordion-panel open' : 'summary-panel accordion-panel'} aria-label="Resumen de reserva">
          <button
            className="accordion-heading"
            type="button"
            aria-expanded={openStep === 3}
            disabled={!selectedSlot && !confirmation}
            onClick={() => {
              if (selectedSlot || confirmation) {
                setOpenStep(3);
              }
            }}
          >
            <span>
              <p className="eyebrow">Paso 3</p>
              <h2>Datos del cliente</h2>
            </span>
            <span className="accordion-icons">
              <CheckCircle2 aria-hidden="true" />
              <ChevronDown aria-hidden="true" />
            </span>
          </button>

          {openStep === 3 && confirmation ? (
            <div className="summary-box">
              <span>{confirmation.depositRequired ? 'Reserva pendiente' : 'Reserva confirmada'}</span>
              <p>Total: {formatPrice(confirmation.totalPrice)}</p>
              {appointmentRequestWhatsappUrl ? (
                <a className="secondary-button proof-link" href={appointmentRequestWhatsappUrl} target="_blank" rel="noreferrer">
                  Avisar al local por WhatsApp
                </a>
              ) : !confirmation.depositRequired ? (
                <p className="muted">El local debe configurar su WhatsApp en el panel admin.</p>
              ) : null}
              {confirmation.depositRequired && (
                <p>Seña sugerida: {formatPrice(confirmation.depositAmount)}</p>
              )}
              {confirmation.depositRequired ? (
                <div className="transfer-details">
                  <strong>{confirmation.staffName}</strong>
                  <strong>Datos para transferir</strong>
                  <dl>
                    <div>
                      <dt>Titular</dt>
                      <dd>{transferDetails.holder}</dd>
                    </div>
                    <div>
                      <dt>Alias</dt>
                      <dd>{transferDetails.alias}</dd>
                    </div>
                    <div>
                      <dt>CBU/CVU</dt>
                      <dd>{transferDetails.cbu}</dd>
                    </div>
                  </dl>
                  {proofWhatsappUrl ? (
                    <a className="secondary-button proof-link" href={proofWhatsappUrl} target="_blank" rel="noreferrer">
                      Enviar comprobante por WhatsApp
                    </a>
                  ) : null}
                  <button className="secondary-button" type="button" onClick={startNewBooking}>
                    Hacer otra reserva
                  </button>
                </div>
              ) : (
                <div className="summary-actions">
                  <button className="secondary-button" type="button" onClick={startNewBooking}>
                    Hacer otra reserva
                  </button>
                </div>
              )}
            </div>
          ) : openStep === 3 ? (
            <form className="stack-form" onSubmit={handleSubmit}>
              <div className="selected-slot-copy">
                {selectedSlot ? (
                  <>
                    <span>{selectedSlot.time}</span>
                    <strong>{selectedSlot.staffName}</strong>
                  </>
                ) : (
                  <p className="muted">El resumen aparece cuando elijas un horario.</p>
                )}
              </div>

              <label>
                Nombre
                <input name="firstName" required minLength={2} />
              </label>
              <label>
                Apellido
                <input name="lastName" required minLength={2} />
              </label>
              <label>
                Número de teléfono
                <input name="phone" required minLength={6} />
              </label>

              {error && <p className="error-text">{error}</p>}

              <button className="primary-cta form-cta" type="submit" disabled={submitting || !selectedSlot}>
                {submitting ? 'Reservando...' : 'Confirmar turno'}
              </button>
            </form>
          ) : null}
        </aside>
      </section>

      <footer className="site-footer">
        <span>© 2026 JV Urban Style Barbería. Todos los derechos reservados.</span>
        <span>Desarrollado por <strong>Enzo Dalmasso</strong></span>
      </footer>
    </main>
  );
}
