import { Wordmark } from '../Wordmark';

type SiteFooterProps = {
  todayLabel: string | null;
};

export function SiteFooter({ todayLabel }: SiteFooterProps) {
  return (
    <footer className="site-footer-bar">
      <div className="site-container site-footer-grid">
        <div className="site-footer-brand">
          <Wordmark showName={false} />
          <div>
            <strong>JV Urban Style Barbería</strong>
            {todayLabel && <span>{todayLabel}</span>}
          </div>
        </div>

        <nav className="site-footer-nav" aria-label="Secciones">
          <a href="#servicios">Servicios</a>
          <a href="#reservar">Reservar</a>
          <a href="#horarios">Horarios</a>
        </nav>

        <div className="site-footer-legal">
          <span>© 2026 JV Urban Style Barbería. Todos los derechos reservados.</span>
          <span>
            Desarrollado por{' '}
            <a href="https://porfolio-enzo-dalmasso.vercel.app/#projects" target="_blank" rel="noreferrer">
              Enzo Dalmasso
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
