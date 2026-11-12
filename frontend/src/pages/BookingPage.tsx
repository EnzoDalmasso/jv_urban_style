import { CalendarDays, MessageCircle, Scissors } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import heroImage from '../assets/barbershop-lounge-hero.webp';
import { DateTimeSelector } from '../components/DateTimeSelector';
import { BookingStep } from '../components/site/BookingStep';
import { HoursSection } from '../components/site/HoursSection';
import { Reveal } from '../components/site/Reveal';
import { ServicesBoard } from '../components/site/ServicesBoard';
import { SiteFooter } from '../components/site/SiteFooter';
import { SiteHeader } from '../components/site/SiteHeader';
import { createAppointment, fetchPublicSchedule, fetchServices } from '../lib/api';
import { formatAppointmentDateTime, formatLongDate, formatPrice } from '../lib/format';
import { describeToday } from '../lib/schedule';
import { scrollToSection } from '../lib/scroll';
import type { AvailabilitySlot, CreateAppointmentResponse, PublicSchedule, Service } from '../types';
import '../site.css';

type BookingStepNumber = 1 | 2 | 3;

function buildWhatsappUrl(phone: string | undefined, message: string) {
  const normalizedPhone = (phone ?? '').replace(/\D/g, '');

  if (!normalizedPhone) {
    return null;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
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
  const [openStep, setOpenStep] = useState<BookingStepNumber>(1);
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
      .catch(() => setServices([]))
      .finally(() => setLoadingServices(false));

    fetchPublicSchedule()
      .then(setSchedule)
      .catch(() => setSchedule(null));
  }, []);

  const todayLabel = schedule ? describeToday(schedule) : null;
  const selectedService = services.find((service) => selectedServiceIds.includes(service.id));

  function toggleService(serviceId: string) {
    setSelectedSlot(undefined);
    setConfirmation(null);
    setSelectedServiceIds((current) => {
      const next = current.includes(serviceId) ? [] : [serviceId];

      setOpenStep(next.length > 0 ? 2 : 1);
      return next;
    });
  }

  function chooseService(serviceId: string) {
    setSelectedSlot(undefined);
    setConfirmation(null);
    setSelectedServiceIds([serviceId]);
    setOpenStep(2);
    scrollToSection('reservar');
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedSlot) {
      setError('Elegí un horario disponible.');
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
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
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear el turno.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="site">
      <SiteHeader todayLabel={todayLabel} />

      <main className="site-main">
        <section className="site-hero" id="inicio" aria-labelledby="hero-title">
          <img className="site-hero-image" src={heroImage} alt="" fetchPriority="high" />
          <div className="site-hero-shade" aria-hidden="true" />

          <div className="site-container site-hero-content">
            <h1 id="hero-title">
              <span>Más que</span>
              <span>un corte.</span>
            </h1>
            <p className="site-hero-lead">
              Elegí el servicio, mirá los horarios libres de cada barbero y dejá tu turno pedido en un minuto.
            </p>
            <div className="site-hero-actions">
              <button className="site-button" type="button" onClick={() => scrollToSection('reservar')}>
                <Scissors aria-hidden="true" />
                Reservar turno
              </button>
              <a className="site-button site-button-ghost" href="#servicios">
                Ver servicios y precios
              </a>
            </div>
          </div>

          {todayLabel && (
            <div className="site-hero-strip">
              <div className="site-container">
                <a href="#horarios">
                  <CalendarDays aria-hidden="true" />
                  {todayLabel}
                </a>
              </div>
            </div>
          )}
        </section>

        <Reveal>
          <ServicesBoard services={services} loading={loadingServices} onChoose={chooseService} />
        </Reveal>

        <section className="site-section site-booking" id="reservar" aria-labelledby="reservar-title">
          <div className="site-container site-booking-grid">
            <header className="site-section-header site-booking-intro">
              <h2 id="reservar-title">Reservá tu turno</h2>
              <p>
                Los horarios se calculan con la agenda real del local. El turno queda pedido y el local
                lo confirma por WhatsApp.
              </p>
            </header>

            <div className="booking-steps">
              <BookingStep
                number={1}
                title="Servicio"
                summary={selectedService ? `${selectedService.name} · ${formatPrice(selectedService.price)}` : undefined}
                isOpen={openStep === 1}
                isDone={Boolean(selectedService)}
                onOpen={() => setOpenStep(1)}
              >
                {loadingServices && <p className="site-muted" role="status">Cargando servicios…</p>}
                <div className="service-picker" role="group" aria-label="Servicios">
                  {services.map((service) => {
                    const active = selectedServiceIds.includes(service.id);

                    return (
                      <button
                        className={active ? 'service-option is-selected' : 'service-option'}
                        key={service.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleService(service.id)}
                      >
                        <span className="service-option-name">{service.name}</span>
                        <span className="service-option-meta">
                          {service.duration_minutes} min · {formatPrice(service.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </BookingStep>

              <BookingStep
                number={2}
                title="Día y horario"
                summary={selectedSlot ? `${formatLongDate(selectedSlot.startsAt)}, ${selectedSlot.time} con ${selectedSlot.staffName}` : undefined}
                isOpen={openStep === 2}
                isDisabled={selectedServiceIds.length === 0}
                isDone={Boolean(selectedSlot)}
                onOpen={() => {
                  if (selectedServiceIds.length > 0) {
                    setOpenStep(2);
                  }
                }}
              >
                <DateTimeSelector
                  serviceIds={selectedServiceIds}
                  selectedSlot={selectedSlot}
                  onSelectSlot={selectSlot}
                  refreshToken={availabilityRefreshToken}
                />
              </BookingStep>

              <BookingStep
                number={3}
                title={confirmation ? 'Turno pedido' : 'Tus datos'}
                isOpen={openStep === 3}
                isDisabled={!selectedSlot && !confirmation}
                isDone={Boolean(confirmation)}
                onOpen={() => {
                  if (selectedSlot || confirmation) {
                    setOpenStep(3);
                  }
                }}
              >
                {confirmation ? (
                  <div className="booking-confirmation" role="status">
                    <p className="booking-confirmation-lead">
                      Listo. Tu turno quedó pedido para el {formatAppointmentDateTime(confirmation.startsAt)} con{' '}
                      {confirmation.staffName}.
                    </p>

                    <dl className="booking-facts">
                      <div>
                        <dt>Total</dt>
                        <dd>{formatPrice(confirmation.totalPrice)}</dd>
                      </div>
                      {confirmation.depositRequired && (
                        <div>
                          <dt>Seña sugerida</dt>
                          <dd>{formatPrice(confirmation.depositAmount)}</dd>
                        </div>
                      )}
                    </dl>

                    {confirmation.depositRequired ? (
                      <div className="booking-transfer">
                        <h4>Datos para transferir la seña</h4>
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
                      </div>
                    ) : !appointmentRequestWhatsappUrl ? (
                      <p className="site-muted">El local debe configurar su WhatsApp en el panel admin.</p>
                    ) : null}

                    <div className="booking-confirmation-actions">
                      {proofWhatsappUrl && (
                        <a className="site-button" href={proofWhatsappUrl} target="_blank" rel="noreferrer">
                          <MessageCircle aria-hidden="true" />
                          Enviar comprobante por WhatsApp
                        </a>
                      )}
                      {appointmentRequestWhatsappUrl && (
                        <a className="site-button" href={appointmentRequestWhatsappUrl} target="_blank" rel="noreferrer">
                          <MessageCircle aria-hidden="true" />
                          Avisar al local por WhatsApp
                        </a>
                      )}
                      <button className="site-button site-button-ghost" type="button" onClick={startNewBooking}>
                        Hacer otra reserva
                      </button>
                    </div>
                  </div>
                ) : (
                  <form className="booking-form" onSubmit={handleSubmit}>
                    {selectedSlot && (
                      <p className="booking-form-recap">
                        {selectedService?.name} · {formatLongDate(selectedSlot.startsAt)}, {selectedSlot.time} con{' '}
                        {selectedSlot.staffName}
                      </p>
                    )}

                    <div className="booking-form-fields">
                      <label>
                        Nombre
                        <input name="firstName" autoComplete="given-name" required minLength={2} maxLength={60} />
                      </label>
                      <label>
                        Apellido
                        <input name="lastName" autoComplete="family-name" required minLength={2} maxLength={60} />
                      </label>
                      <label className="booking-form-wide">
                        Teléfono
                        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required minLength={6} maxLength={25} />
                      </label>
                    </div>

                    {error && <p className="site-error" role="alert">{error}</p>}

                    <button className="site-button booking-submit" type="submit" disabled={submitting || !selectedSlot}>
                      {submitting ? 'Reservando…' : 'Confirmar turno'}
                    </button>
                  </form>
                )}
              </BookingStep>
            </div>
          </div>
        </section>

        <Reveal>
          <HoursSection schedule={schedule} />
        </Reveal>
      </main>

      <SiteFooter todayLabel={todayLabel} />
    </div>
  );
}
