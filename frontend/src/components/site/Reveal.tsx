import { type ReactNode, useEffect, useRef, useState } from 'react';

type RevealProps = {
  children: ReactNode;
};

// Entrada suave de una seccion cuando aparece en pantalla. El CSS solo la anima
// con prefers-reduced-motion: no-preference; sin IntersectionObserver se muestra directo.
export function Reveal({ children }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const node = ref.current;

    if (!node || visible) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '0px 0px -12% 0px' });

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={visible ? 'site-reveal is-visible' : 'site-reveal'}>
      {children}
    </div>
  );
}
