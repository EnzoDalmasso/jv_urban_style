import {
  CalendarClock,
  Check,
  Clock,
  LogOut,
  Minus,
  Plus,
  Save,
  Scissors,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import {
  createAdminStaff,
  deleteAdminStaff,
  deleteAdminSpecialHours,
  fetchAdminSummary,
  saveAdminBusinessHours,
  saveAdminSpecialHours,
  updateAdminAppointmentStatus,
  updateAdminService,
  updateAdminStaff,
  updateAdminSettings
} from '../lib/api';
import type { AdminSummary, BusinessHours, Service, ShopSettings, Staff } from '../types';

const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shortTime(value: string) {
  return value.slice(0, 5);
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(Number(price));
}

export function AdminPage() {
  const [pin, setPin] = useState(() => localStorage.getItem('adminPin') ?? '');
  const [pinDraft, setPinDraft] = useState('');
  const [date, setDate] = useState(todayISO);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!pin) {
      return;
    }

    setLoading(true);
    setError(null);
    fetchAdminSummary({ date, pin })
      .then(setSummary)
      .catch((err: Error) => {
        setError(err.message);
        if (err.message.toLowerCase().includes('pin')) {
          localStorage.removeItem('adminPin');
          setPin('');
        }
      })
      .finally(() => setLoading(false));
  }, [date, pin]);

  const staffHistory = useMemo(() => {
    const activeStaff = (summary?.staff ?? []).filter((person) => person.is_active !== false);

    return activeStaff.map((person) => ({
      staff: person,
      appointments: (summary?.appointments ?? []).filter((appointment) => (
        appointment.staffId === person.id || appointment.staffName === person.full_name
      ))
    }));
  }, [summary?.appointments, summary?.staff]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    localStorage.setItem('adminPin', pinDraft);
    setPin(pinDraft);
  }

  function logout() {
    localStorage.removeItem('adminPin');
    setPin('');
    setSummary(null);
  }

  async function reload() {
    if (!pin) {
      return;
    }
    const next = await fetchAdminSummary({ date, pin });
    setSummary(next);
  }

  async function saveSettings(settings: ShopSettings) {
    setSaving('settings');
    await updateAdminSettings(pin, {
      cancellationNoticeMinutes: Number(settings.cancellation_notice_minutes),
      depositPercentage: Number(settings.deposit_percentage),
      requireDepositForLateCancellation: settings.require_deposit_for_late_cancellation
    });
    await reload();
    setSaving(null);
  }

  async function saveService(service: Service) {
    setSaving(service.id);
    await updateAdminService(pin, service.id, {
      name: service.name,
      description: service.description,
      durationMinutes: Number(service.duration_minutes),
      price: Number(service.price),
      isActive: Boolean(service.is_active ?? true)
    });
    await reload();
    setSaving(null);
  }

  async function saveStaff(person: Staff) {
    setSaving(person.id);
    await updateAdminStaff(pin, person.id, {
      fullName: person.full_name,
      role: person.role,
      isActive: Boolean(person.is_active ?? true)
    });
    await reload();
    setSaving(null);
  }

  async function addStaff() {
    setSaving('new-staff');
    await createAdminStaff(pin, {
      fullName: 'Nuevo profesional',
      role: 'barber'
    });
    await reload();
    setSaving(null);
  }

  async function removeStaff(person: Staff) {
    setSaving(person.id);
    await deleteAdminStaff(pin, person.id);
    await reload();
    setSaving(null);
  }

  async function saveHours(hours: BusinessHours) {
    setSaving(`hours-${hours.id}`);
    await saveAdminBusinessHours(pin, {
      staffId: hours.staff_id,
      dayOfWeek: hours.day_of_week,
      opensAt: shortTime(hours.opens_at),
      closesAt: shortTime(hours.closes_at),
      isClosed: hours.is_closed
    });
    await reload();
    setSaving(null);
  }

  async function addSpecialHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaving('special');
    await saveAdminSpecialHours(pin, {
      date: String(formData.get('date')),
      staffId: String(formData.get('staffId') || '') || null,
      opensAt: String(formData.get('opensAt')),
      closesAt: String(formData.get('closesAt')),
      isClosed: formData.get('isClosed') === 'on',
      reason: String(formData.get('reason') ?? '')
    });
    event.currentTarget.reset();
    await reload();
    setSaving(null);
  }

  async function removeSpecialHours(id: string) {
    setSaving(id);
    await deleteAdminSpecialHours(pin, id);
    await reload();
    setSaving(null);
  }

  async function changeAppointmentStatus(id: string, status: string) {
    setSaving(id);
    await updateAdminAppointmentStatus(pin, id, status);
    await reload();
    setSaving(null);
  }

  function patchSummary(partial: Partial<AdminSummary>) {
    setSummary((current) => current ? { ...current, ...partial } : current);
  }

  if (!pin) {
    return (
      <main className="admin-shell compact">
        <section className="admin-login">
          <BrandLogo compact />
          <ShieldCheck aria-hidden="true" />
          <p className="eyebrow">Admin</p>
          <h1>Panel del local</h1>
          <form className="stack-form" onSubmit={handleLogin}>
            <label>
              PIN
              <input
                value={pinDraft}
                onChange={(event) => setPinDraft(event.target.value)}
                minLength={4}
                required
                type="password"
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <button className="primary-cta form-cta" type="submit">Entrar</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">JV Urban Style</p>
          <div className="admin-title-row">
            <BrandLogo compact />
            <h1>Panel de agenda</h1>
          </div>
        </div>
        <button className="icon-text-button" type="button" onClick={logout}>
          <LogOut aria-hidden="true" />
          Salir
        </button>
      </header>

      <section className="admin-toolbar">
        <label>
          Dia
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <div className="admin-stat">
          <CalendarClock aria-hidden="true" />
          <span>{summary?.appointments.length ?? 0}</span>
          <small>turnos</small>
        </div>
        <div className="admin-stat">
          <Scissors aria-hidden="true" />
          <span>{summary?.services.filter((service) => service.is_active !== false).length ?? 0}</span>
          <small>servicios</small>
        </div>
      </section>

      {loading && <p className="muted">Cargando panel...</p>}
      {error && <p className="error-text">{error}</p>}

      {summary && (
        <div className="admin-grid">
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Cobros</p>
                <h2>Seña y cancelación</h2>
              </div>
              <Save aria-hidden="true" />
            </div>

            <div className="settings-grid">
              <label>
                Minutos mínimos para cancelar
                <input
                  type="number"
                  min={0}
                  value={summary.settings.cancellation_notice_minutes}
                  onChange={(event) => patchSummary({
                    settings: {
                      ...summary.settings,
                      cancellation_notice_minutes: Number(event.target.value)
                    }
                  })}
                />
              </label>
              <label>
                Porcentaje de seña
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Number(summary.settings.deposit_percentage)}
                  onChange={(event) => patchSummary({
                    settings: {
                      ...summary.settings,
                      deposit_percentage: Number(event.target.value)
                    }
                  })}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={summary.settings.require_deposit_for_late_cancellation}
                  onChange={(event) => patchSummary({
                    settings: {
                      ...summary.settings,
                      require_deposit_for_late_cancellation: event.target.checked
                    }
                  })}
                />
                Pedir seña
              </label>
            </div>

            <button
              className="secondary-button"
              type="button"
              onClick={() => saveSettings(summary.settings)}
              disabled={saving === 'settings'}
            >
              <Check aria-hidden="true" />
              Guardar politica
            </button>
          </section>

          <section className="admin-panel wide">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Servicios</p>
                <h2>Precios y duración</h2>
              </div>
              <Scissors aria-hidden="true" />
            </div>

            <div className="editable-list">
              {summary.services.map((service) => (
                <div className="editable-row" key={service.id}>
                  <input
                    value={service.name}
                    onChange={(event) => patchSummary({
                      services: summary.services.map((item) => (
                        item.id === service.id ? { ...item, name: event.target.value } : item
                      ))
                    })}
                  />
                  <input
                    type="number"
                    min={5}
                    value={service.duration_minutes}
                    onChange={(event) => patchSummary({
                      services: summary.services.map((item) => (
                        item.id === service.id ? { ...item, duration_minutes: Number(event.target.value) } : item
                      ))
                    })}
                  />
                  <input
                    type="number"
                    min={0}
                    value={Number(service.price)}
                    onChange={(event) => patchSummary({
                      services: summary.services.map((item) => (
                        item.id === service.id ? { ...item, price: Number(event.target.value) } : item
                      ))
                    })}
                  />
                  <label className="checkbox-row compact-check">
                    <input
                      type="checkbox"
                      checked={service.is_active !== false}
                      onChange={(event) => patchSummary({
                        services: summary.services.map((item) => (
                          item.id === service.id ? { ...item, is_active: event.target.checked } : item
                        ))
                      })}
                    />
                    Activo
                  </label>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => saveService(service)}
                    disabled={saving === service.id}
                    aria-label="Guardar servicio"
                  >
                    <Save aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel wide">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Equipo</p>
                <h2>Profesionales</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={addStaff}
                disabled={saving === 'new-staff'}
                aria-label="Agregar profesional"
              >
                <Plus aria-hidden="true" />
              </button>
            </div>

            <div className="editable-list">
              {summary.staff.map((person) => (
                <div className="staff-row" key={person.id}>
                  <input
                    value={person.full_name}
                    onChange={(event) => patchSummary({
                      staff: summary.staff.map((item) => (
                        item.id === person.id ? { ...item, full_name: event.target.value } : item
                      ))
                    })}
                  />
                  <input
                    value={person.role ?? 'barber'}
                    onChange={(event) => patchSummary({
                      staff: summary.staff.map((item) => (
                        item.id === person.id ? { ...item, role: event.target.value } : item
                      ))
                    })}
                  />
                  <label className="checkbox-row compact-check">
                    <input
                      type="checkbox"
                      checked={person.is_active !== false}
                      onChange={(event) => patchSummary({
                        staff: summary.staff.map((item) => (
                          item.id === person.id ? { ...item, is_active: event.target.checked } : item
                        ))
                      })}
                    />
                    Activo
                  </label>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => saveStaff(person)}
                    disabled={saving === person.id}
                    aria-label="Guardar profesional"
                  >
                    <Save aria-hidden="true" />
                  </button>
                  <button
                    className="icon-button danger"
                    type="button"
                    onClick={() => removeStaff(person)}
                    disabled={saving === person.id}
                    aria-label="Quitar profesional"
                  >
                    <Minus aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel wide">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Horarios</p>
                <h2>Semana laboral</h2>
              </div>
              <Clock aria-hidden="true" />
            </div>

            <div className="hours-list">
              {summary.businessHours.map((hours) => (
                <div className="hours-row" key={`${hours.staff_id ?? 'global'}-${hours.day_of_week}`}>
                  <strong>{dayLabels[hours.day_of_week]}</strong>
                  <span>{hours.staff_id ? summary.staff.find((staff) => staff.id === hours.staff_id)?.full_name : 'General'}</span>
                  <input
                    type="time"
                    value={shortTime(hours.opens_at)}
                    onChange={(event) => patchSummary({
                      businessHours: summary.businessHours.map((item) => (
                        item.id === hours.id ? { ...item, opens_at: event.target.value } : item
                      ))
                    })}
                  />
                  <input
                    type="time"
                    value={shortTime(hours.closes_at)}
                    onChange={(event) => patchSummary({
                      businessHours: summary.businessHours.map((item) => (
                        item.id === hours.id ? { ...item, closes_at: event.target.value } : item
                      ))
                    })}
                  />
                  <label className="checkbox-row compact-check">
                    <input
                      type="checkbox"
                      checked={hours.is_closed}
                      onChange={(event) => patchSummary({
                        businessHours: summary.businessHours.map((item) => (
                          item.id === hours.id ? { ...item, is_closed: event.target.checked } : item
                        ))
                      })}
                    />
                    Cerrado
                  </label>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => saveHours(hours)}
                    disabled={saving === `hours-${hours.id}`}
                    aria-label="Guardar horario"
                  >
                    <Save aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Feriados</p>
                <h2>Horario especial</h2>
              </div>
              <CalendarClock aria-hidden="true" />
            </div>

            <form className="stack-form" onSubmit={addSpecialHours}>
              <label>
                Fecha
                <input name="date" type="date" defaultValue={date} required />
              </label>
              <label>
                Profesional
                <select name="staffId" defaultValue="">
                  <option value="">General</option>
                  {summary.staff.map((staff) => (
                    <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                  ))}
                </select>
              </label>
              <div className="inline-fields">
                <label>
                  Desde
                  <input name="opensAt" type="time" defaultValue="10:00" required />
                </label>
                <label>
                  Hasta
                  <input name="closesAt" type="time" defaultValue="19:00" required />
                </label>
              </div>
              <label>
                Motivo
                <input name="reason" placeholder="Feriado, evento, refuerzo" />
              </label>
              <label className="checkbox-row">
                <input name="isClosed" type="checkbox" />
                Cerrado todo el dia
              </label>
              <button className="secondary-button" type="submit" disabled={saving === 'special'}>
                <Check aria-hidden="true" />
                Guardar especial
              </button>
            </form>

            <div className="mini-list">
              {summary.specialHours.map((hours) => (
                <div className="mini-row" key={hours.id}>
                  <span>{hours.is_closed ? 'Cerrado' : `${shortTime(hours.opens_at)} - ${shortTime(hours.closes_at)}`}</span>
                  <small>{hours.reason || 'Especial'}</small>
                  <button
                    className="icon-button danger"
                    type="button"
                    onClick={() => removeSpecialHours(hours.id)}
                    aria-label="Eliminar horario especial"
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel wide">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Historial</p>
                <h2>Turnos del dia</h2>
              </div>
              <CalendarClock aria-hidden="true" />
            </div>

            {staffHistory.length === 0 && <p className="muted">Sin profesionales activos.</p>}

            {staffHistory.map(({ staff, appointments }) => (
              <div className="appointment-group" key={staff.id}>
                <h3>{staff.full_name}</h3>
                <div className="appointment-list">
                  {appointments.length === 0 && (
                    <article className="appointment-card empty">
                      <div>
                        <strong>{date}</strong>
                        <span>Sin cortes registrados</span>
                      </div>
                    </article>
                  )}

                  {appointments.map((appointment) => (
                    <article className="appointment-card" key={appointment.id}>
                      <div>
                        <strong>{new Date(appointment.startsAt).toLocaleDateString('es-AR')}</strong>
                        <span>{new Date(appointment.startsAt).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                        <span>{appointment.clientName}</span>
                        <small>{appointment.clientPhone}</small>
                      </div>
                      <div>
                        <span>Corte: {appointment.services.map((service) => service.name).join(', ')}</span>
                        <small>{formatPrice(appointment.totalPrice)} - {appointment.status}</small>
                        {appointment.depositRequired && (
                          <small>Seña: {formatPrice(appointment.depositAmount)} ({appointment.depositStatus})</small>
                        )}
                      </div>
                      <div className="status-actions">
                        <button type="button" onClick={() => changeAppointmentStatus(appointment.id, 'completed')}>Hecho</button>
                        <button type="button" onClick={() => changeAppointmentStatus(appointment.id, 'cancelled')}>Cancelar</button>
                        <button type="button" onClick={() => changeAppointmentStatus(appointment.id, 'no_show')}>No vino</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
