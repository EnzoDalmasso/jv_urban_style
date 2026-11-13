import { CalendarDays, Menu, X } from 'lucide-react';
import { type MouseEvent, useEffect, useState } from 'react';
import { scrollToSection } from '../../lib/scroll';
import { Wordmark } from '../Wordmark';

type SiteHeaderProps = {
  todayLabel: string | null;
};

const links = [
  { id: 'servicios', label: 'Servicios' },
  { id: 'trabajos', label: 'Trabajos' },
  { id: 'reservar', label: 'Reservar' },
  { id: 'horarios', label: 'Horarios' }
];

export function SiteHeader({ todayLabel }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.body.classList.add('site-menu-open');
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('site-menu-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // Con el menu abierto el body no scrollea: hay que liberarlo antes de ir a la seccion.
  function goTo(id: string, event?: MouseEvent) {
    event?.preventDefault();
    setMenuOpen(false);
    document.body.classList.remove('site-menu-open');
    scrollToSection(id);
  }

  return (
    <header className={['site-header', scrolled ? 'is-scrolled' : '', menuOpen ? 'is-menu-open' : ''].filter(Boolean).join(' ')}>
      <div className="site-header-inner">
        <a className="site-home-link" href="#inicio" aria-label="JV Urban Style Barbería, inicio" onClick={(event) => goTo('inicio', event)}>
          <Wordmark />
        </a>

        <nav className="site-nav" aria-label="Secciones">
          {links.map((link) => (
            <a key={link.id} href={`#${link.id}`} onClick={(event) => goTo(link.id, event)}>{link.label}</a>
          ))}
        </nav>

        <button className="site-button site-button-small site-header-cta" type="button" onClick={() => goTo('reservar')}>
          Reservar turno
        </button>

        <button
          className="site-menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="site-mobile-menu"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      <div className="site-mobile-menu" id="site-mobile-menu" inert={!menuOpen}>
        <nav aria-label="Secciones">
          {links.map((link) => (
            <a key={link.id} href={`#${link.id}`} onClick={(event) => goTo(link.id, event)}>{link.label}</a>
          ))}
        </nav>
        <button className="site-button" type="button" onClick={() => goTo('reservar')}>
          Reservar turno
        </button>
        {todayLabel && (
          <p className="site-mobile-menu-today">
            <CalendarDays aria-hidden="true" />
            {todayLabel}
          </p>
        )}
      </div>
    </header>
  );
}
