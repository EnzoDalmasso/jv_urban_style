import type {
  AdminSummary,
  AvailabilityResponse,
  CreateAppointmentResponse,
  Service
} from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export async function fetchServices() {
  const response = await fetch(`${API_URL}/api/services`);

  if (!response.ok) {
    throw new Error('No pudimos cargar los servicios.');
  }

  return response.json() as Promise<{ services: Service[] }>;
}

export async function fetchAvailability(params: {
  date: string;
  serviceIds: string[];
  staffId?: string;
  signal?: AbortSignal;
}) {
  const searchParams = new URLSearchParams({
    date: params.date,
    serviceIds: params.serviceIds.join(',')
  });

  if (params.staffId) {
    searchParams.set('staffId', params.staffId);
  }

  const response = await fetch(`${API_URL}/api/availability?${searchParams.toString()}`, {
    signal: params.signal
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? 'No pudimos consultar la disponibilidad.');
  }

  return response.json() as Promise<AvailabilityResponse>;
}

export async function createAppointment(payload: {
  serviceIds: string[];
  staffId: string;
  startsAt: string;
  client: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    notes?: string;
  };
  notes?: string;
}) {
  const response = await fetch(`${API_URL}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? 'No pudimos crear el turno.');
  }

  return response.json() as Promise<CreateAppointmentResponse>;
}

export async function fetchAdminSummary(params: { date: string; pin: string }) {
  return adminFetch<AdminSummary>(`/api/admin/summary?date=${params.date}`, params.pin);
}

export async function updateAdminSettings(pin: string, payload: {
  cancellationNoticeMinutes?: number;
  depositPercentage?: number;
  requireDepositForLateCancellation?: boolean;
}) {
  return adminFetch('/api/admin/settings', pin, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function updateAdminService(pin: string, serviceId: string, payload: {
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  price?: number;
  isActive?: boolean;
}) {
  return adminFetch(`/api/admin/services/${serviceId}`, pin, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function saveAdminBusinessHours(pin: string, payload: {
  staffId?: string | null;
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}) {
  return adminFetch('/api/admin/business-hours', pin, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function saveAdminSpecialHours(pin: string, payload: {
  staffId?: string | null;
  date: string;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  reason?: string | null;
}) {
  return adminFetch('/api/admin/special-hours', pin, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function deleteAdminSpecialHours(pin: string, id: string) {
  return adminFetch(`/api/admin/special-hours/${id}`, pin, {
    method: 'DELETE'
  });
}

export async function updateAdminAppointmentStatus(pin: string, id: string, status: string) {
  return adminFetch(`/api/admin/appointments/${id}/status`, pin, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

async function adminFetch<T = unknown>(path: string, pin: string, init?: RequestInit) {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': pin,
        ...(init?.headers ?? {})
      }
    });
  } catch {
    throw new Error('No pudimos conectar con el backend. Revisa VITE_API_URL en Vercel y CORS_ORIGIN en Render.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? 'No pudimos completar la accion.');
  }

  return response.json() as Promise<T>;
}
