import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from 'react';
import { type GalleryItem, galleryItems } from '../../lib/gallery';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type GalleryTileProps = {
  item: GalleryItem;
  onOpen: () => void;
};

// Los videos del carrusel se reproducen sin sonido solo mientras estan a la vista.
function GalleryTile({ item, onOpen }: GalleryTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    }, { threshold: 0.6 });

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <li>
      <button className="works-tile" type="button" onClick={onOpen} aria-label={`Ver en grande: ${item.alt}`}>
        {item.type === 'photo' ? (
          <img src={item.src} alt="" loading="lazy" decoding="async" width={720} height={960} />
        ) : (
          <>
            <video ref={videoRef} src={item.src} poster={item.poster} muted loop playsInline preload="none" aria-hidden="true" />
            <span className="works-tile-badge">
              <Play aria-hidden="true" />
              Video
            </span>
          </>
        )}
      </button>
    </li>
  );
}

export function WorksGallery() {
  const railRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openItem = openIndex === null ? null : galleryItems[openIndex];

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog && openIndex !== null && !dialog.open) {
      dialog.showModal();
    }
  }, [openIndex]);

  function scrollRail(direction: 1 | -1) {
    const rail = railRef.current;
    rail?.scrollBy({
      left: direction * rail.clientWidth * 0.8,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
  }

  function step(delta: 1 | -1) {
    setOpenIndex((current) => current === null
      ? current
      : (current + delta + galleryItems.length) % galleryItems.length);
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    // Un click en el fondo (fuera del contenido) cierra el visor.
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'ArrowRight') {
      step(1);
    } else if (event.key === 'ArrowLeft') {
      step(-1);
    }
  }

  return (
    <section className="site-section site-works" id="trabajos" aria-labelledby="trabajos-title">
      <div className="site-container">
        <header className="site-section-header site-works-header">
          <div>
            <h2 id="trabajos-title">Trabajos</h2>
            <p>Cortes reales de clientes del local. Tocá uno para verlo en grande.</p>
          </div>
          <div className="works-rail-controls">
            <button className="works-arrow" type="button" onClick={() => scrollRail(-1)} aria-label="Trabajos anteriores">
              <ChevronLeft aria-hidden="true" />
            </button>
            <button className="works-arrow" type="button" onClick={() => scrollRail(1)} aria-label="Más trabajos">
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </header>
      </div>

      <ul className="works-rail" ref={railRef}>
        {galleryItems.map((item, index) => (
          <GalleryTile key={item.src} item={item} onOpen={() => setOpenIndex(index)} />
        ))}
      </ul>

      <dialog
        className="works-viewer"
        ref={dialogRef}
        aria-label="Trabajo en grande"
        onClose={() => setOpenIndex(null)}
        onClick={handleDialogClick}
        onKeyDown={handleDialogKeyDown}
      >
        {openItem && (
          <div className="works-viewer-frame">
            {openItem.type === 'photo' ? (
              <img src={openItem.src} alt={openItem.alt} />
            ) : (
              <video key={openItem.src} src={openItem.src} poster={openItem.poster} controls autoPlay playsInline aria-label={openItem.alt} />
            )}
          </div>
        )}

        <button className="works-viewer-close" type="button" onClick={close} aria-label="Cerrar">
          <X aria-hidden="true" />
        </button>
        <button className="works-viewer-nav is-prev" type="button" onClick={() => step(-1)} aria-label="Anterior">
          <ChevronLeft aria-hidden="true" />
        </button>
        <button className="works-viewer-nav is-next" type="button" onClick={() => step(1)} aria-label="Siguiente">
          <ChevronRight aria-hidden="true" />
        </button>
        {openIndex !== null && (
          <p className="works-viewer-count">{openIndex + 1} de {galleryItems.length}</p>
        )}
      </dialog>
    </section>
  );
}
