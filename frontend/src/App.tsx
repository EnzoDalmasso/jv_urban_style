import { CheckCircle2, Scissors, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DateTimeSelector } from './components/DateTimeSelector';
import { fetchServices } from './lib/api';
import type { AvailabilitySlot, Service } from './types';

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(price);
}

export default function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | undefined>();
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    fetchServices()
      .then((response) => setServices(response.services))
      .finally(() => setLoadingServices(false));
  }, []);

  function toggleService(serviceId: string) {
    setSelectedSlot(undefined);
    setSelectedServiceIds((current) => (
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    ));
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Distrito Barber</p>
          <h1>Reservas urbanas, agenda prolija y estilo sin espera.</h1>
          <p>
            Elegí el servicio, encontrá un horario libre en tiempo real y dejá tu turno listo
            en menos de un minuto.
          </p>
          <a className="primary-cta" href="#booking">
            <Scissors aria-hidden="true" />
            Reservar turno
          </a>
        </div>
        <div className="hero-metric" aria-label="Resumen de servicios">
          <Sparkles aria-hidden="true" />
          <strong>10:00 - 19:00</strong>
          <span>Cortes, barba y color con profesionales activos.</span>
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
                    {service.duration_minutes} min · {formatPrice(service.price)}
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
          {selectedSlot ? (
            <div className="summary-box">
              <span>{selectedSlot.time}</span>
              <strong>{selectedSlot.staffName}</strong>
              <p>Ya podés continuar con nombre, WhatsApp y notas del turno.</p>
            </div>
          ) : (
            <p className="muted">El resumen aparece cuando elijas un horario.</p>
          )}
        </aside>
      </section>
    </main>
  );
}
