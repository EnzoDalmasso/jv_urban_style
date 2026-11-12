import { Clock, Scissors } from 'lucide-react';
import type { Service } from '../../types';
import { formatPrice } from '../../lib/format';

type ServicesBoardProps = {
  services: Service[];
  loading: boolean;
  onChoose: (serviceId: string) => void;
};

export function ServicesBoard({ services, loading, onChoose }: ServicesBoardProps) {
  return (
    <section className="site-section site-services" id="servicios" aria-labelledby="servicios-title">
      <div className="site-container">
        <header className="site-section-header">
          <h2 id="servicios-title">Servicios y precios</h2>
          <p>Tocá un servicio para elegirlo y pasar directo a los horarios.</p>
        </header>

        {loading && <p className="site-muted" role="status">Cargando servicios…</p>}

        {!loading && services.length === 0 && (
          <p className="site-muted">No pudimos cargar los servicios. Recargá la página en unos minutos.</p>
        )}

        <ul className="price-board">
          {services.map((service) => (
            <li key={service.id}>
              <button
                className="price-row"
                type="button"
                onClick={() => onChoose(service.id)}
                aria-label={`Reservar ${service.name}, ${formatPrice(service.price)}`}
              >
                <span className="price-row-line">
                  <span className="price-row-name">{service.name}</span>
                  <span className="price-row-leader" aria-hidden="true" />
                  <span className="price-row-price">{formatPrice(service.price)}</span>
                </span>
                <span className="price-row-details">
                  {service.description && <span>{service.description}</span>}
                  <span className="price-row-duration">
                    <Clock aria-hidden="true" />
                    {service.duration_minutes} min
                  </span>
                </span>
                <span className="price-row-action" aria-hidden="true">
                  <Scissors />
                  Reservar
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
