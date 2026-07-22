import { CheckCircle2, Scissors } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { DateTimeSelector } from '../components/DateTimeSelector';
import { createAppointment, fetchServices } from '../lib/api';
import type { AvailabilitySlot, CreateAppointmentResponse, Service } from '../types';

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

export function BookingPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | undefined>();
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<CreateAppointmentResponse['appointment'] | null>(null);
  const transferDetails = confirmation?.transfer ?? {
    holder: 'JV Urban Style Barberia',
    alias: 'JVURBANSTYLE',
    cbu: 'Configurar en admin'
  };
  const proofWhatsappUrl = confirmation
    ? buildWhatsappUrl(
        confirmation.businessWhatsappPhone,
        'Hola JV Urban Style, ya reservé mi turno. Envío el comprobante de la seña.'
      )
    : null;

  useEffect(() => {
    fetchServices()
      .then((response) => setServices(response.services))
      .finally(() => setLoadingServices(false));
  }, []);

  function toggleService(serviceId: string) {
    setSelectedSlot(undefined);
    setConfirmation(null);
    setSelectedServiceIds((current) => (
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    ));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear el turno.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="brand-lockup">
            <BrandLogo />
            <div>
              <p className="eyebrow">JV Urban Style</p>
            </div>
          </div>
          <h1>Reservas urbanas, agenda prolija y estilo sin espera.</h1>
          <p>
            Elegí el servicio, encontrá un horario libre en tiempo real y dejá tu turno listo
            en menos de un minuto.
          </p>
          <button className="primary-cta" type="button" onClick={scrollToBooking}>
            <Scissors aria-hidden="true" />
            Reservar turno
          </button>
        </div>
      </section>

      <section className="booking-layout" id="booking">
        <div className="booking-panel" aria-labelledby="services-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Paso 1</p>
              <h2 id="services-title">Seleccioná servicios</h2>
            </div>
            <Scissors aria-hidden="true" />
          </div>

          <div className="service-grid">
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
        </div>

        <DateTimeSelector
          serviceIds={selectedServiceIds}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
        />

        <aside className="summary-panel" aria-label="Resumen de reserva">
          <p className="eyebrow">Paso 3</p>
          <h2>Confirmación</h2>

          {confirmation ? (
            <div className="summary-box">
              <span>Código {confirmation.publicCode}</span>
              <strong>{confirmation.staffName}</strong>
              <p>Total: {formatPrice(confirmation.totalPrice)}</p>
              {confirmation.depositRequired && (
                <p>Seña sugerida: {formatPrice(confirmation.depositAmount)}</p>
              )}
              <div className="transfer-details">
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
                ) : (
                  <p className="muted">El local debe configurar su WhatsApp en el panel admin.</p>
                )}
              </div>
            </div>
          ) : (
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
          )}
        </aside>
      </section>

      <footer className="site-footer">
        <span>© 2026 JV Urban Style Barberia. Todos los derechos reservados.</span>
        <span>Desarrollado por <strong>Enzo Dalmasso</strong></span>
      </footer>
    </main>
  );
}
