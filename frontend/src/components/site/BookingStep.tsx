import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

type BookingStepProps = {
  number: 1 | 2 | 3;
  title: string;
  summary?: string;
  isOpen: boolean;
  isDisabled?: boolean;
  isDone?: boolean;
  onOpen: () => void;
  children: ReactNode;
};

// El contenido queda montado aunque el paso este cerrado, asi no se pierde
// el estado interno (fecha elegida, datos del formulario) al ir y volver.
export function BookingStep({
  number,
  title,
  summary,
  isOpen,
  isDisabled = false,
  isDone = false,
  onOpen,
  children
}: BookingStepProps) {
  const headingId = `booking-step-${number}`;
  const className = [
    'booking-step',
    isOpen ? 'is-open' : '',
    isDone ? 'is-done' : '',
    isDisabled ? 'is-disabled' : ''
  ].filter(Boolean).join(' ');

  return (
    <section className={className} aria-labelledby={headingId}>
      <button
        className="booking-step-heading"
        type="button"
        aria-expanded={isOpen}
        disabled={isDisabled}
        onClick={onOpen}
      >
        <span className="booking-step-number" aria-hidden="true">
          {isDone && !isOpen ? <Check /> : number}
        </span>
        <span className="booking-step-titles">
          <h3 id={headingId}>{title}</h3>
          {summary && !isOpen && <span className="booking-step-summary">{summary}</span>}
        </span>
        <ChevronDown className="booking-step-chevron" aria-hidden="true" />
      </button>

      <div className="booking-step-body" inert={!isOpen}>
        <div className="booking-step-inner">
          <div className="booking-step-content">{children}</div>
        </div>
      </div>
    </section>
  );
}
