import type { PublicSchedule } from '../../types';
import { formatRange, formatScheduleDate, globalSpecialHours, summarizeBusinessHours } from '../../lib/schedule';

type HoursSectionProps = {
  schedule: PublicSchedule | null;
};

export function HoursSection({ schedule }: HoursSectionProps) {
  const weeklyHours = schedule ? summarizeBusinessHours(schedule.businessHours) : [];
  const specialHours = schedule ? globalSpecialHours(schedule.specialHours).slice(0, 6) : [];
  const staff = schedule?.staff ?? [];
  const today = new Date().getDay();

  return (
    <section className="site-section site-hours" id="horarios" aria-labelledby="horarios-title">
      <div className="site-container site-hours-grid">
        <header className="site-section-header">
          <h2 id="horarios-title">Horarios</h2>
          <p>Los turnos se reservan dentro de este horario. Los días especiales tienen prioridad.</p>
        </header>

        <div className="hours-card">
          {weeklyHours.length > 0 ? (
            <dl className="hours-list">
              {weeklyHours.map((hour) => (
                <div
                  key={hour.day}
                  className={[hour.day === today ? 'is-today' : '', hour.isClosed ? 'is-closed' : ''].filter(Boolean).join(' ')}
                >
                  <dt>
                    {hour.label}
                    {hour.day === today && <span className="hours-today">Hoy</span>}
                  </dt>
                  <dd>{hour.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="site-muted">El local todavía no publicó sus horarios.</p>
          )}
        </div>

        <div className="hours-aside">
          {specialHours.length > 0 && (
            <div className="hours-special">
              <h3>Días especiales</h3>
              <ul>
                {specialHours.map((hour) => (
                  <li key={hour.id}>
                    <span>{formatScheduleDate(hour.date)}</span>
                    <span>{hour.is_closed ? (hour.reason || 'Cerrado') : formatRange(hour)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {staff.length > 0 && (
            <div className="hours-team">
              <h3>Te atienden</h3>
              <ul>
                {staff.map((person) => (
                  <li key={person.id}>
                    <span className="hours-team-initial" aria-hidden="true">{person.full_name.charAt(0)}</span>
                    {person.full_name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
