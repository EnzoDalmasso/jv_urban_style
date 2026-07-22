import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
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
  clearAdminAppointments,
  createAdminService,
  createAdminStaff,
  deleteAdminService,
  deleteAdminStaff,
  deleteAdminSpecialHours,
  fetchAdminSummary,
  saveAdminBusinessHours,
  saveAdminSpecialHours,
  updateAdminAppointmentDepositStatus,
  updateAdminAppointmentStatus,
  updateAdminService,
  updateAdminStaff,
  updateAdminSettings
} from '../lib/api';
import type { AdminSummary, BusinessHours, Service, ShopSettings, Staff } from '../types';

const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type AdminPanelId = 'payments' | 'services' | 'staff' | 'hours' | 'specialHours' | 'history';

const defaultOpenPanels: Record<AdminPanelId, boolean> = {
  payments: false,
  services: false,
  staff: false,
  hours: false,
  specialHours: false,
  history: true
};

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

function minutesToHours(minutes: number) {
  return Number((Number(minutes) / 60).toFixed(2));
}

function hoursToMinutes(hours: string) {
  return Math.max(0, Math.round(Number(hours || 0) * 60));
}

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

function formatAppointmentTime(startsAt: string) {
  return new Date(startsAt).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function depositLabel(status: string) {
  const labels: Record<string, string> = {
    not_required: 'no requerida',
    pending: 'pendiente',
    paid: 'recibida',
    waived: 'sin seña'
  };

  return labels[status] ?? status;
}

function appointmentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendiente de comprobante',
    confirmed: 'Reservado',
    cancelled: 'Cancelado',
    completed: 'Hecho',
    no_show: 'No vino'
  };

  return labels[status] ?? status;
}

export function AdminPage() {
  const [pin, setPin] = useState(() => localStorage.getItem('adminPin') ?? '');
  const [pinDraft, setPinDraft] = useState('');
  const [date, setDate] = useState(todayISO);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [openPanels, setOpenPanels] = useState(defaultOpenPanels);
  const [openStaffHistory, setOpenStaffHistory] = useState<Record<string, boolean>>({});

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

  function togglePanel(panelId: AdminPanelId) {
    setOpenPanels((current) => ({
      ...current,
      [panelId]: !current[panelId]
    }));
  }

  function toggleStaffHistory(staffId: string) {
    setOpenStaffHistory((current) => ({
      ...current,
      [staffId]: !current[staffId]
    }));
  }

  async function reload() {
    if (!pin) {
      return;
    }
    const next = await fetchAdminSummary({ date, pin });
    setSummary(next);
  }

  async function saveSettings(settings: ShopSettings) {
    await runAdminAction('settings', async () => {
      await updateAdminSettings(pin, {
        cancellationNoticeMinutes: Number(settings.cancellation_notice_minutes),
        depositPercentage: Number(settings.deposit_percentage),
        requireDepositForLateCancellation: settings.require_deposit_for_late_cancellation,
        transferHolder: settings.transfer_holder ?? '',
        transferAlias: settings.transfer_alias ?? '',
        transferCbu: settings.transfer_cbu ?? '',
        whatsappPhone: settings.whatsapp_phone ?? ''
      });
      await reload();
    });
  }

  async function addService() {
    setOpenPanels((current) => ({ ...current, services: true }));
    await runAdminAction('new-service', async () => {
      await createAdminService(pin, {
        name: 'Nuevo servicio',
        description: 'Editar descripcion',
        durationMinutes: 45,
        price: 0
      });
      await reload();
    });
  }

  async function saveService(service: Service) {
    await runAdminAction(service.id, async () => {
      await updateAdminService(pin, service.id, {
        name: service.name,
        description: service.description,
        durationMinutes: Number(service.duration_minutes),
        price: Number(service.price),
        isActive: Boolean(service.is_active ?? true)
      });
      await reload();
    });
  }

  async function removeService(service: Service) {
    await runAdminAction(service.id, async () => {
      await deleteAdminService(pin, service.id);
      await reload();
    });
  }

  async function saveStaff(person: Staff) {
    await runAdminAction(person.id, async () => {
      await updateAdminStaff(pin, person.id, {
        fullName: person.full_name,
        role: person.role,
        isActive: Boolean(person.is_active ?? true)
      });
      await reload();
    });
  }

  async function addStaff() {
    setOpenPanels((current) => ({ ...current, staff: true }));
    await runAdminAction('new-staff', async () => {
      await createAdminStaff(pin, {
        fullName: 'Nuevo profesional',
        role: 'barber'
      });
      await reload();
    });
  }

  async function removeStaff(person: Staff) {
    await runAdminAction(person.id, async () => {
      await deleteAdminStaff(pin, person.id);
      await reload();
    });
  }

  async function saveHours(hours: BusinessHours) {
    await runAdminAction(`hours-${hours.id}`, async () => {
      await saveAdminBusinessHours(pin, {
        staffId: hours.staff_id,
        dayOfWeek: hours.day_of_week,
        opensAt: shortTime(hours.opens_at),
        closesAt: shortTime(hours.closes_at),
        isClosed: hours.is_closed
      });
      await reload();
    });
  }

  async function addSpecialHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await runAdminAction('special', async () => {
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
    });
  }

  async function removeSpecialHours(id: string) {
    await runAdminAction(id, async () => {
      await deleteAdminSpecialHours(pin, id);
      await reload();
    });
  }

  async function changeAppointmentStatus(id: string, status: string) {
    await runAdminAction(id, async () => {
      await updateAdminAppointmentStatus(pin, id, status);
      await reload();
    });
  }

  async function changeDepositStatus(id: string, depositStatus: string, whatsappUrl?: string | null) {
    const notificationUrl = depositStatus === 'paid' ? whatsappUrl : null;
    const whatsappWindow = depositStatus === 'paid' && whatsappUrl
      ? window.open('about:blank', '_blank')
      : null;
    const saved = await runAdminAction(`deposit-${id}`, async () => {
      await updateAdminAppointmentDepositStatus(pin, id, depositStatus);
      await reload();
    });

    if (whatsappWindow) {
      if (saved && notificationUrl) {
        whatsappWindow.location.href = notificationUrl;
      } else {
        whatsappWindow.close();
      }
    }
  }

  async function clearDayHistory() {
    const confirmed = window.confirm(
      `Esto borra todos los turnos del ${date} y libera esos horarios. ¿Querés limpiar el historial de pruebas?`
    );

    if (!confirmed) {
      return;
    }

    await runAdminAction('clear-history', async () => {
      await clearAdminAppointments(pin, date);
      await reload();
    });
  }

  async function runAdminAction(actionId: string, action: () => Promise<void>) {
    setSaving(actionId);
    setError(null);

    try {
      await action();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
      return false;
    } finally {
      setSaving(null);
    }
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
            <div className="panel-heading collapsible-heading">
              <button
                className="panel-toggle-button"
                type="button"
                onClick={() => togglePanel('payments')}
                aria-expanded={openPanels.payments}
              >
                <div>
                  <p className="eyebrow">Cobros</p>
                  <h2>Seña y cancelación</h2>
                </div>
                {openPanels.payments ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
              <Save aria-hidden="true" />
            </div>

            {openPanels.payments && (
              <>
            <div className="settings-grid">
              <label>
                Horas mínimas para cancelar
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={minutesToHours(summary.settings.cancellation_notice_minutes)}
                  onChange={(event) => patchSummary({
                    settings: {
                      ...summary.settings,
                      cancellation_notice_minutes: hoursToMinutes(event.target.value)
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

            <div className="settings-subheading">
              <h3>Datos de transferencia</h3>
            </div>

            <div className="settings-grid transfer-settings">
              <label>
                Titular
                <input
                  value={summary.settings.transfer_holder ?? ''}
                  onChange={(event) => patchSummary({
                    settings: {
                      ...summary.settings,
                      transfer_holder: event.target.value
                    }
                  })}
                />
              </label>
              <label>
                Alias
                <input
                  value={summary.settings.transfer_alias ?? ''}
                  onChange={(event) => patchSummary({
                    settings: {
                      ...summary.settings,
                      transfer_alias: event.target.value
                    }
                  })}
                />
              </label>
              <label>
                CBU/CVU
                <input
                  value={summary.settings.transfer_cbu ?? ''}
                  onChange={(event) => patchSummary({
                    settings: {
                      ...summary.settings,
                      transfer_cbu: event.target.value
                    }
                  })}
                />
              </label>
              <label>
                WhatsApp del local
                <input
                  value={summary.settings.whatsapp_phone ?? ''}
                  placeholder="Ej: 5493510000000"
                  onChange={(event) => patchSummary({
                    settings: {
                      ...summary.settings,
                      whatsapp_phone: event.target.value
                    }
                  })}
                />
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
              </>
            )}
          </section>

          <section className="admin-panel wide">
            <div className="panel-heading collapsible-heading">
              <button
                className="panel-toggle-button"
                type="button"
                onClick={() => togglePanel('services')}
                aria-expanded={openPanels.services}
              >
                <div>
                  <p className="eyebrow">Servicios</p>
                  <h2>Precios y duración</h2>
                </div>
                {openPanels.services ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={addService}
                disabled={saving === 'new-service'}
                aria-label="Agregar servicio"
              >
                <Plus aria-hidden="true" />
              </button>
            </div>

            {openPanels.services && (
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
                  <button
                    className="icon-button danger"
                    type="button"
                    onClick={() => removeService(service)}
                    disabled={saving === service.id}
                    aria-label="Quitar servicio"
                  >
                    <Minus aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            )}
          </section>

          <section className="admin-panel wide">
            <div className="panel-heading collapsible-heading">
              <button
                className="panel-toggle-button"
                type="button"
                onClick={() => togglePanel('staff')}
                aria-expanded={openPanels.staff}
              >
                <div>
                  <p className="eyebrow">Equipo</p>
                  <h2>Profesionales</h2>
                </div>
                {openPanels.staff ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
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

            {openPanels.staff && (
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
            )}
          </section>

          <section className="admin-panel wide">
            <div className="panel-heading collapsible-heading">
              <button
                className="panel-toggle-button"
                type="button"
                onClick={() => togglePanel('hours')}
                aria-expanded={openPanels.hours}
              >
                <div>
                  <p className="eyebrow">Horarios</p>
                  <h2>Semana laboral</h2>
                </div>
                {openPanels.hours ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
              <Clock aria-hidden="true" />
            </div>

            {openPanels.hours && (
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
            )}
          </section>

          <section className="admin-panel">
            <div className="panel-heading collapsible-heading">
              <button
                className="panel-toggle-button"
                type="button"
                onClick={() => togglePanel('specialHours')}
                aria-expanded={openPanels.specialHours}
              >
                <div>
                  <p className="eyebrow">Feriados</p>
                  <h2>Horario especial</h2>
                </div>
                {openPanels.specialHours ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
              <CalendarClock aria-hidden="true" />
            </div>

            {openPanels.specialHours && (
              <>
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
              </>
            )}
          </section>

          <section className="admin-panel wide">
            <div className="panel-heading collapsible-heading">
              <button
                className="panel-toggle-button"
                type="button"
                onClick={() => togglePanel('history')}
                aria-expanded={openPanels.history}
              >
                <div>
                  <p className="eyebrow">Historial</p>
                  <h2>Turnos del dia</h2>
                </div>
                {openPanels.history ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
              <button
                className="icon-text-button danger compact-action"
                type="button"
                onClick={clearDayHistory}
                disabled={saving === 'clear-history' || summary.appointments.length === 0}
              >
                <Trash2 aria-hidden="true" />
                Limpiar
              </button>
            </div>

            {openPanels.history && (
              <>
            {staffHistory.length === 0 && <p className="muted">Sin profesionales activos.</p>}

            {staffHistory.map(({ staff, appointments }) => (
              <div className="appointment-group" key={staff.id}>
                <button
                  className="staff-history-toggle"
                  type="button"
                  onClick={() => toggleStaffHistory(staff.id)}
                  aria-expanded={Boolean(openStaffHistory[staff.id])}
                >
                  <span>{staff.full_name}</span>
                  <small>{appointments.length} turnos</small>
                  {openStaffHistory[staff.id] ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                </button>
                {openStaffHistory[staff.id] && (
                <div className="appointment-list">
                  {appointments.length === 0 && (
                    <article className="appointment-card empty">
                      <div>
                        <strong>{date}</strong>
                        <span>Sin cortes registrados</span>
                      </div>
                    </article>
                  )}

                  {appointments.map((appointment) => {
                    const appointmentDate = new Date(appointment.startsAt).toLocaleDateString('es-AR');
                    const appointmentTime = formatAppointmentTime(appointment.startsAt);
                    const servicesText = appointment.services.map((service) => service.name).join(', ');
                    const pendingProofUrl = buildWhatsappUrl(
                      appointment.clientPhone,
                      `Hola ${appointment.clientName}, recibimos tu turno en JV Urban Style para el ${appointmentDate} a las ${appointmentTime}. Queda pendiente el comprobante de la seña.`
                    );
                    const acceptedUrl = buildWhatsappUrl(
                      appointment.clientPhone,
                      `Hola ${appointment.clientName}, ya recibimos el comprobante de tu seña. Tu turno queda confirmado para el ${appointmentDate} a las ${appointmentTime}. Te esperamos en JV Urban Style.`
                    );

                    return (
                    <article className="appointment-card" key={appointment.id}>
                      <div>
                        <strong>{appointmentDate}</strong>
                        <span>{appointmentTime}</span>
                        <span>{appointment.clientName}</span>
                        <small>{appointment.clientPhone}</small>
                      </div>
                      <div>
                        <span>Corte: {servicesText}</span>
                        <small>
                          {formatPrice(appointment.totalPrice)} - {
                            appointment.depositRequired && appointment.depositStatus === 'pending'
                              ? 'Pendiente de comprobante'
                              : appointmentStatusLabel(appointment.status)
                          }
                        </small>
                        {appointment.depositRequired && (
                          <small>Seña: {formatPrice(appointment.depositAmount)} ({depositLabel(appointment.depositStatus)})</small>
                        )}
                      </div>
                      <div className="status-actions">
                        {appointment.depositRequired && (
                          <button
                            type="button"
                            disabled={saving === `deposit-${appointment.id}`}
                            onClick={() => changeDepositStatus(
                              appointment.id,
                              appointment.depositStatus === 'paid' ? 'pending' : 'paid',
                              appointment.depositStatus === 'paid' ? null : acceptedUrl
                            )}
                          >
                            {appointment.depositStatus === 'paid' ? 'Marcar pendiente' : 'Seña recibida'}
                          </button>
                        )}
                        {pendingProofUrl && appointment.depositStatus !== 'paid' && (
                          <a className="status-link" href={pendingProofUrl} target="_blank" rel="noreferrer">
                            Pedir comprobante
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={saving === appointment.id}
                          onClick={() => changeAppointmentStatus(appointment.id, 'completed')}
                        >
                          {saving === appointment.id ? 'Guardando...' : 'Hecho'}
                        </button>
                        <button
                          type="button"
                          disabled={saving === appointment.id}
                          onClick={() => changeAppointmentStatus(appointment.id, 'cancelled')}
                        >
                          {appointment.status === 'pending' || appointment.depositStatus === 'pending' ? 'Rechazar' : 'Cancelar'}
                        </button>
                        <button
                          type="button"
                          disabled={saving === appointment.id}
                          onClick={() => changeAppointmentStatus(appointment.id, 'no_show')}
                        >
                          No vino
                        </button>
                      </div>
                    </article>
                    );
                  })}
                </div>
                )}
              </div>
            ))}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
