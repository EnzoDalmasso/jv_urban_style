import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Bell,
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
  createAdminFixedAppointment,
  createAdminService,
  createAdminStaff,
  deleteAdminFixedAppointment,
  deleteAdminService,
  deleteAdminStaff,
  deleteAdminSpecialHours,
  fetchAdminSummary,
  fetchAdminPushConfig,
  saveAdminBusinessHours,
  saveAdminSpecialHours,
  saveAdminPushSubscription,
  sendAdminPushTest,
  updateAdminAppointmentDepositStatus,
  updateAdminAppointmentStatus,
  updateAdminFixedAppointment,
  updateAdminService,
  updateAdminStaff,
  updateAdminSettings
} from '../lib/api';
import type { AdminAppointment, AdminSummary, BusinessHours, FixedAppointment, Service, ShopSettings, Staff } from '../types';

const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type AdminPanelId = 'payments' | 'services' | 'staff' | 'hours' | 'specialHours' | 'fixedAppointments' | 'upcoming' | 'history';
type SpecialMode = 'hours' | 'closed' | 'vacation';
type PushStatus = 'idle' | 'saving' | 'enabled' | 'unsupported' | 'blocked' | 'needs_config' | 'error';

const defaultOpenPanels: Record<AdminPanelId, boolean> = {
  payments: false,
  services: false,
  staff: false,
  hours: false,
  specialHours: false,
  fixedAppointments: false,
  upcoming: true,
  history: true
};

function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateRange(startDate: string, endDate: string) {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate || startDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Fecha invalida.');
  }

  if (end < start) {
    throw new Error('La fecha hasta no puede ser anterior a la fecha desde.');
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(formatISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
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

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
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
    pending: 'Pendiente',
    confirmed: 'Reservado',
    cancelled: 'Rechazado',
    completed: 'Corte realizado',
    no_show: 'No vino'
  };

  return labels[status] ?? status;
}

function isTerminalAppointment(status: string) {
  return ['cancelled', 'completed', 'no_show'].includes(status);
}

function appointmentDisplayLabel(appointment: AdminAppointment) {
  if (isTerminalAppointment(appointment.status)) {
    return appointmentStatusLabel(appointment.status);
  }

  if (appointment.depositRequired && appointment.depositStatus === 'pending') {
    return 'Pendiente de comprobante';
  }

  if (appointment.status === 'pending') {
    return 'Pendiente de aceptación';
  }

  return appointmentStatusLabel(appointment.status);
}

function canManageAttendance(appointment: AdminAppointment) {
  return appointment.status === 'confirmed'
    && new Date(appointment.startsAt).getTime() <= Date.now();
}

type AppointmentCardProps = {
  appointment: AdminAppointment;
  saving: string | null;
  showAttendanceActions: boolean;
  onChangeStatus: (id: string, status: string, whatsappUrl?: string | null) => void;
  onChangeDepositStatus: (id: string, depositStatus: string, whatsappUrl?: string | null) => void;
};

function AppointmentCard({
  appointment,
  saving,
  showAttendanceActions,
  onChangeStatus,
  onChangeDepositStatus
}: AppointmentCardProps) {
  const appointmentDate = new Date(appointment.startsAt).toLocaleDateString('es-AR');
  const appointmentTime = formatAppointmentTime(appointment.startsAt);
  const servicesText = appointment.services.map((service) => service.name).join(', ');
  const isTerminal = isTerminalAppointment(appointment.status);
  const canShowAttendanceActions = showAttendanceActions && appointment.status === 'confirmed';
  const canShowCancelAction = appointment.status === 'pending' || !canShowAttendanceActions;
  const displayStatus = appointmentDisplayLabel(appointment);
  const pendingProofUrl = buildWhatsappUrl(
    appointment.clientPhone,
    `Hola ${appointment.clientName}, recibimos tu turno en JV Urban Style para el ${appointmentDate} a las ${appointmentTime}. Queda pendiente el comprobante de la seña.`
  );
  const acceptedUrl = buildWhatsappUrl(
    appointment.clientPhone,
    `Hola ${appointment.clientName}, ya recibimos el comprobante de tu seña. Tu turno queda confirmado para el ${appointmentDate} a las ${appointmentTime}. Te esperamos en JV Urban Style.`
  );
  const confirmedUrl = buildWhatsappUrl(
    appointment.clientPhone,
    `Hola ${appointment.clientName}, confirmamos tu turno en JV Urban Style para el ${appointmentDate} a las ${appointmentTime}. Te esperamos.`
  );
  const rejectedUrl = buildWhatsappUrl(
    appointment.clientPhone,
    `Hola ${appointment.clientName}, te pedimos disculpas, pero no vamos a poder confirmar tu turno en JV Urban Style para el ${appointmentDate} a las ${appointmentTime}. Si queres, podes solicitar otro horario disponible desde la web. Muchas gracias.`
  );

  return (
    <article className="appointment-card">
      <div>
        <strong>{appointmentDate}</strong>
        <span>{appointmentTime}</span>
        <span>{appointment.clientName}</span>
        <small>{appointment.clientPhone}</small>
      </div>
      <div>
        <span>Corte: {servicesText}</span>
        <small>
          {formatPrice(appointment.totalPrice)} - {displayStatus}
        </small>
        {appointment.depositRequired && (
          <small>Seña: {formatPrice(appointment.depositAmount)} ({depositLabel(appointment.depositStatus)})</small>
        )}
      </div>
      <div className="status-actions">
        {isTerminal ? (
          <span className={`status-badge status-${appointment.status}`}>
            {displayStatus}
          </span>
        ) : (
          <>
            {appointment.depositRequired && appointment.depositStatus !== 'paid' && (
              <button
                type="button"
                disabled={saving === `deposit-${appointment.id}`}
                onClick={() => onChangeDepositStatus(
                  appointment.id,
                  'paid',
                  acceptedUrl
                )}
              >
                Seña recibida
              </button>
            )}
            {appointment.depositRequired && appointment.depositStatus === 'paid' && appointment.status === 'confirmed' && (
              <span className="status-badge status-confirmed">
                Turno confirmado
              </span>
            )}
            {appointment.depositRequired && pendingProofUrl && appointment.depositStatus !== 'paid' && (
              <a className="status-link" href={pendingProofUrl} target="_blank" rel="noreferrer">
                Pedir comprobante
              </a>
            )}
            {!appointment.depositRequired && appointment.status === 'pending' && (
              <button
                type="button"
                disabled={saving === appointment.id}
                onClick={() => onChangeStatus(appointment.id, 'confirmed', confirmedUrl)}
              >
                Confirmar turno
              </button>
            )}
            {canShowAttendanceActions && (
              <button
                type="button"
                disabled={saving === appointment.id}
                onClick={() => onChangeStatus(appointment.id, 'completed')}
              >
                {saving === appointment.id ? 'Guardando...' : 'Vino'}
              </button>
            )}
            {canShowCancelAction && (
              <button
                type="button"
                disabled={saving === appointment.id}
                onClick={() => onChangeStatus(
                  appointment.id,
                  'cancelled',
                  appointment.status === 'pending' || appointment.depositStatus === 'pending' ? rejectedUrl : null
                )}
              >
                {appointment.status === 'pending' || appointment.depositStatus === 'pending' ? 'Rechazar' : 'Cancelar'}
              </button>
            )}
            {canShowAttendanceActions && (
              <button
                type="button"
                disabled={saving === appointment.id}
                onClick={() => onChangeStatus(appointment.id, 'no_show')}
              >
                No vino
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
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
  const [openStaffUpcoming, setOpenStaffUpcoming] = useState<Record<string, boolean>>({});
  const [specialMode, setSpecialMode] = useState<SpecialMode>('hours');
  const [pushStatus, setPushStatus] = useState<PushStatus>('idle');
  const [pushMessage, setPushMessage] = useState('');

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

  const staffUpcomingAppointments = useMemo(() => {
    const activeStaff = (summary?.staff ?? []).filter((person) => person.is_active !== false);

    return activeStaff.map((person) => ({
      staff: person,
      appointments: (summary?.upcomingAppointments ?? []).filter((appointment) => (
        appointment.staffId === person.id || appointment.staffName === person.full_name
      ))
    }));
  }, [summary?.staff, summary?.upcomingAppointments]);

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

  function toggleStaffUpcoming(staffId: string) {
    setOpenStaffUpcoming((current) => ({
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
      const startDate = String(formData.get('date'));
      const endDate = specialMode === 'vacation'
        ? String(formData.get('endDate') || startDate)
        : startDate;
      const isClosed = specialMode !== 'hours';
      const dates = buildDateRange(startDate, endDate);
      const reason = String(formData.get('reason') ?? '').trim()
        || (specialMode === 'vacation' ? 'Vacaciones' : specialMode === 'closed' ? 'Feriado' : 'Horario especial');

      await Promise.all(dates.map((specialDate) => saveAdminSpecialHours(pin, {
        date: specialDate,
        staffId: String(formData.get('staffId') || '') || null,
        opensAt: specialMode === 'hours' ? String(formData.get('opensAt')) : '10:00',
        closesAt: specialMode === 'hours' ? String(formData.get('closesAt')) : '19:00',
        isClosed,
        reason
      })));

      event.currentTarget.reset();
      setSpecialMode('hours');
      if (startDate !== date) {
        setDate(startDate);
      } else {
        await reload();
      }
    });
  }

  async function removeSpecialHours(id: string) {
    await runAdminAction(id, async () => {
      await deleteAdminSpecialHours(pin, id);
      await reload();
    });
  }

  async function addFixedAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const staffId = String(formData.get('staffId') || '');

    if (!staffId) {
      setError('Elegí un profesional para el turno fijo.');
      return;
    }

    await runAdminAction('fixed-new', async () => {
      await createAdminFixedAppointment(pin, {
        staffId,
        dayOfWeek: Number(formData.get('dayOfWeek')),
        startsAt: String(formData.get('startsAt')),
        durationMinutes: Number(formData.get('durationMinutes')),
        clientName: String(formData.get('clientName') ?? ''),
        note: String(formData.get('note') ?? ''),
        isActive: true
      });
      event.currentTarget.reset();
      await reload();
    });
  }

  async function saveFixedAppointment(fixedAppointment: FixedAppointment) {
    await runAdminAction(fixedAppointment.id, async () => {
      await updateAdminFixedAppointment(pin, fixedAppointment.id, {
        staffId: fixedAppointment.staff_id,
        dayOfWeek: fixedAppointment.day_of_week,
        startsAt: shortTime(fixedAppointment.starts_at),
        durationMinutes: Number(fixedAppointment.duration_minutes),
        clientName: fixedAppointment.client_name,
        note: fixedAppointment.note ?? '',
        isActive: Boolean(fixedAppointment.is_active)
      });
      await reload();
    });
  }

  async function removeFixedAppointment(fixedAppointment: FixedAppointment) {
    await runAdminAction(fixedAppointment.id, async () => {
      await deleteAdminFixedAppointment(pin, fixedAppointment.id);
      await reload();
    });
  }

  async function changeAppointmentStatus(id: string, status: string, whatsappUrl?: string | null) {
    const whatsappWindow = whatsappUrl ? window.open('about:blank', '_blank') : null;
    const saved = await runAdminAction(id, async () => {
      await updateAdminAppointmentStatus(pin, id, status);
      await reload();
    });

    if (whatsappWindow) {
      if (saved && whatsappUrl) {
        whatsappWindow.location.href = whatsappUrl;
      } else {
        whatsappWindow.close();
      }
    }
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

  async function enablePushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushStatus('unsupported');
      setPushMessage('Este navegador no soporta notificaciones push PWA.');
      return;
    }

    setPushStatus('saving');
    setPushMessage('');

    try {
      const config = await fetchAdminPushConfig(pin);

      if (!config.enabled || !config.publicKey) {
        setPushStatus('needs_config');
        setPushMessage('Faltan configurar las claves WEB_PUSH en Render.');
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        setPushStatus('blocked');
        setPushMessage('El navegador bloqueó las notificaciones. Revisá permisos del sitio.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey)
      });

      const serializedSubscription = subscription.toJSON();
      await saveAdminPushSubscription(pin, serializedSubscription);
      const testResult = await sendAdminPushTest(pin, serializedSubscription);
      if (testResult.sent <= 0 && testResult.error) {
        throw new Error(`No se pudo enviar la prueba push: ${testResult.error}`);
      }
      setPushStatus('enabled');
      setPushMessage(
        testResult.sent > 0
          ? 'Notificaciones activas. Te enviamos una prueba a este dispositivo.'
          : 'Dispositivo guardado, pero no se pudo enviar la prueba. Revisá permisos/notificaciones del iPhone.'
      );
    } catch (err) {
      console.error(err);
      setPushStatus('error');
      setPushMessage(err instanceof Error ? err.message : 'No se pudieron activar las notificaciones.');
    }
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
        <div className="admin-header-actions">
          <button className="icon-text-button" type="button" onClick={enablePushNotifications} disabled={pushStatus === 'saving'}>
            <Bell aria-hidden="true" />
            <span className="push-label-full">{pushStatus === 'enabled' ? 'Notificaciones activas' : 'Activar notificaciones'}</span>
            <span className="push-label-short">{pushStatus === 'enabled' ? 'Activas' : 'Notificaciones'}</span>
          </button>
          <button className="icon-text-button" type="button" onClick={logout}>
            <LogOut aria-hidden="true" />
            Salir
          </button>
        </div>
      </header>

      {pushMessage && (
        <p className={pushStatus === 'enabled' ? 'success-text' : 'error-text'}>{pushMessage}</p>
      )}

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
        <div className="admin-stat">
          <CalendarClock aria-hidden="true" />
          <span>{summary?.upcomingAppointments?.length ?? 0}</span>
          <small>futuros</small>
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
                onClick={() => togglePanel('fixedAppointments')}
                aria-expanded={openPanels.fixedAppointments}
              >
                <div>
                  <p className="eyebrow">Agenda</p>
                  <h2>Turnos fijos</h2>
                </div>
                {openPanels.fixedAppointments ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
              <CalendarClock aria-hidden="true" />
            </div>

            {openPanels.fixedAppointments && (
              <>
                <form className="stack-form" onSubmit={addFixedAppointment}>
                  <label>
                    Profesional
                    <select name="staffId" defaultValue="" required>
                      <option value="">Elegir profesional</option>
                      {summary.staff.map((staff) => (
                        <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Cliente
                    <input name="clientName" placeholder="Nombre del cliente fijo" required minLength={2} />
                  </label>
                  <div className="inline-fields">
                    <label>
                      Día
                      <select name="dayOfWeek" defaultValue={1}>
                        {dayLabels.map((label, index) => (
                          <option key={label} value={index}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Hora
                      <input name="startsAt" type="time" defaultValue="10:00" required />
                    </label>
                  </div>
                  <label>
                    Duración en minutos
                    <input name="durationMinutes" type="number" min={5} defaultValue={30} required />
                  </label>
                  <label>
                    Nota
                    <input name="note" placeholder="Opcional" />
                  </label>
                  <button className="secondary-button" type="submit" disabled={saving === 'fixed-new'}>
                    <Plus aria-hidden="true" />
                    Agregar turno fijo
                  </button>
                </form>

                <div className="editable-list fixed-list">
                  {(summary.fixedAppointments ?? []).length === 0 && (
                    <p className="muted panel-empty-copy">Sin turnos fijos cargados.</p>
                  )}

                  {(summary.fixedAppointments ?? []).map((fixedAppointment) => (
                    <div className="fixed-row" key={fixedAppointment.id}>
                      <select
                        value={fixedAppointment.staff_id}
                        onChange={(event) => patchSummary({
                          fixedAppointments: (summary.fixedAppointments ?? []).map((item) => (
                            item.id === fixedAppointment.id ? { ...item, staff_id: event.target.value } : item
                          ))
                        })}
                      >
                        {summary.staff.map((staff) => (
                          <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                        ))}
                      </select>
                      <input
                        value={fixedAppointment.client_name}
                        onChange={(event) => patchSummary({
                          fixedAppointments: (summary.fixedAppointments ?? []).map((item) => (
                            item.id === fixedAppointment.id ? { ...item, client_name: event.target.value } : item
                          ))
                        })}
                      />
                      <select
                        value={fixedAppointment.day_of_week}
                        onChange={(event) => patchSummary({
                          fixedAppointments: (summary.fixedAppointments ?? []).map((item) => (
                            item.id === fixedAppointment.id ? { ...item, day_of_week: Number(event.target.value) } : item
                          ))
                        })}
                      >
                        {dayLabels.map((label, index) => (
                          <option key={label} value={index}>{label}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={shortTime(fixedAppointment.starts_at)}
                        onChange={(event) => patchSummary({
                          fixedAppointments: (summary.fixedAppointments ?? []).map((item) => (
                            item.id === fixedAppointment.id ? { ...item, starts_at: event.target.value } : item
                          ))
                        })}
                      />
                      <input
                        type="number"
                        min={5}
                        value={fixedAppointment.duration_minutes}
                        onChange={(event) => patchSummary({
                          fixedAppointments: (summary.fixedAppointments ?? []).map((item) => (
                            item.id === fixedAppointment.id ? { ...item, duration_minutes: Number(event.target.value) } : item
                          ))
                        })}
                      />
                      <label className="checkbox-row compact-check">
                        <input
                          type="checkbox"
                          checked={fixedAppointment.is_active}
                          onChange={(event) => patchSummary({
                            fixedAppointments: (summary.fixedAppointments ?? []).map((item) => (
                              item.id === fixedAppointment.id ? { ...item, is_active: event.target.checked } : item
                            ))
                          })}
                        />
                        Activo
                      </label>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => saveFixedAppointment(fixedAppointment)}
                        disabled={saving === fixedAppointment.id}
                        aria-label="Guardar turno fijo"
                      >
                        <Save aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        onClick={() => removeFixedAppointment(fixedAppointment)}
                        disabled={saving === fixedAppointment.id}
                        aria-label="Quitar turno fijo"
                      >
                        <Minus aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

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
                  <h2>Especiales y vacaciones</h2>
                </div>
                {openPanels.specialHours ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
              <CalendarClock aria-hidden="true" />
            </div>

            {openPanels.specialHours && (
              <>
            <form className="stack-form" onSubmit={addSpecialHours}>
              <label>
                Tipo
                <select
                  value={specialMode}
                  onChange={(event) => setSpecialMode(event.target.value as SpecialMode)}
                >
                  <option value="hours">Horario especial</option>
                  <option value="closed">Cerrado por feriado</option>
                  <option value="vacation">Cerrado por vacaciones</option>
                </select>
              </label>
              <div className="inline-fields">
              <label>
                Desde
                <input name="date" type="date" defaultValue={date} required />
              </label>
              {specialMode === 'vacation' && (
                <label>
                  Hasta
                  <input name="endDate" type="date" defaultValue={date} required />
                </label>
              )}
              </div>
              <label>
                Profesional
                <select name="staffId" defaultValue="">
                  <option value="">General</option>
                  {summary.staff.map((staff) => (
                    <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                  ))}
                </select>
              </label>
              {specialMode === 'hours' && (
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
              )}
              <label>
                Motivo
                <input
                  name="reason"
                  placeholder={specialMode === 'vacation' ? 'Vacaciones' : 'Feriado, evento, refuerzo'}
                />
              </label>
              <button className="secondary-button" type="submit" disabled={saving === 'special'}>
                <Check aria-hidden="true" />
                {specialMode === 'vacation' ? 'Guardar vacaciones' : specialMode === 'closed' ? 'Guardar cierre' : 'Guardar especial'}
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
                onClick={() => togglePanel('upcoming')}
                aria-expanded={openPanels.upcoming}
              >
                <div>
                  <p className="eyebrow">Pendientes</p>
                  <h2>Solicitudes futuras</h2>
                </div>
                {openPanels.upcoming ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
              <CalendarClock aria-hidden="true" />
            </div>

            {openPanels.upcoming && (
              <>
                {(summary.upcomingAppointments ?? []).length === 0 && (
                  <p className="muted panel-empty-copy">Sin solicitudes futuras para gestionar.</p>
                )}

                {staffUpcomingAppointments
                  .filter(({ appointments }) => appointments.length > 0)
                  .map(({ staff, appointments }) => (
                    <div className="appointment-group" key={staff.id}>
                      <button
                        className="staff-history-toggle"
                        type="button"
                        onClick={() => toggleStaffUpcoming(staff.id)}
                        aria-expanded={Boolean(openStaffUpcoming[staff.id])}
                      >
                        <span>{staff.full_name}</span>
                        <small>{appointments.length} pendientes</small>
                        {openStaffUpcoming[staff.id] ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                      </button>
                      {openStaffUpcoming[staff.id] && (
                        <div className="appointment-list">
                          {appointments.map((appointment) => (
                            <AppointmentCard
                              appointment={appointment}
                              key={appointment.id}
                              saving={saving}
                              showAttendanceActions={canManageAttendance(appointment)}
                              onChangeStatus={changeAppointmentStatus}
                              onChangeDepositStatus={changeDepositStatus}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
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
              <CalendarClock aria-hidden="true" />
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

                  {appointments.map((appointment) => (
                    <AppointmentCard
                      appointment={appointment}
                      key={appointment.id}
                      saving={saving}
                      showAttendanceActions={canManageAttendance(appointment)}
                      onChangeStatus={changeAppointmentStatus}
                      onChangeDepositStatus={changeDepositStatus}
                    />
                  ))}
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
