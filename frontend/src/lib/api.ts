import type {
  AdminSummary,
  AvailabilityResponse,
  CreateAppointmentResponse,
  GalleryEntry,
  GalleryMediaType,
  PublicSchedule,
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

export async function fetchPublicSchedule() {
  const response = await fetch(`${API_URL}/api/schedule`);

  if (!response.ok) {
    throw new Error('No pudimos cargar los horarios.');
  }

  return response.json() as Promise<PublicSchedule>;
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
  transferHolder?: string;
  transferAlias?: string;
  transferCbu?: string;
  whatsappPhone?: string;
}) {
  return adminFetch('/api/admin/settings', pin, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function createAdminService(pin: string, payload: {
  name: string;
  description?: string | null;
  durationMinutes?: number;
  price?: number;
}) {
  return adminFetch('/api/admin/services', pin, {
    method: 'POST',
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

export async function deleteAdminService(pin: string, serviceId: string) {
  return adminFetch(`/api/admin/services/${serviceId}`, pin, {
    method: 'DELETE'
  });
}

export async function updateAdminStaff(pin: string, staffId: string, payload: {
  fullName?: string;
  role?: string;
  isActive?: boolean;
}) {
  return adminFetch(`/api/admin/staff/${staffId}`, pin, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function createAdminStaff(pin: string, payload: {
  fullName: string;
  role?: string;
}) {
  return adminFetch('/api/admin/staff', pin, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function deleteAdminStaff(pin: string, staffId: string) {
  return adminFetch(`/api/admin/staff/${staffId}`, pin, {
    method: 'DELETE'
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

export async function createAdminFixedAppointment(pin: string, payload: {
  staffId: string;
  dayOfWeek: number;
  startsAt: string;
  durationMinutes: number;
  clientName: string;
  note?: string | null;
  isActive?: boolean;
}) {
  return adminFetch('/api/admin/fixed-appointments', pin, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAdminFixedAppointment(pin: string, id: string, payload: {
  staffId?: string;
  dayOfWeek?: number;
  startsAt?: string;
  durationMinutes?: number;
  clientName?: string;
  note?: string | null;
  isActive?: boolean;
}) {
  return adminFetch(`/api/admin/fixed-appointments/${id}`, pin, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteAdminFixedAppointment(pin: string, id: string) {
  return adminFetch(`/api/admin/fixed-appointments/${id}`, pin, {
    method: 'DELETE'
  });
}

export async function updateAdminAppointmentStatus(pin: string, id: string, status: string) {
  return adminFetch(`/api/admin/appointments/${id}/status`, pin, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function updateAdminAppointmentDepositStatus(pin: string, id: string, depositStatus: string) {
  return adminFetch(`/api/admin/appointments/${id}/deposit`, pin, {
    method: 'PATCH',
    body: JSON.stringify({ depositStatus })
  });
}

export async function fetchAdminPushConfig(pin: string) {
  return adminFetch<{ publicKey: string; enabled: boolean }>('/api/admin/push-config', pin);
}

export async function saveAdminPushSubscription(pin: string, subscription: PushSubscriptionJSON) {
  return adminFetch('/api/admin/push-subscriptions', pin, {
    method: 'POST',
    body: JSON.stringify(subscription)
  });
}

export async function sendAdminPushTest(pin: string, subscription: PushSubscriptionJSON) {
  return adminFetch<{ sent: number; failed: number; error?: string }>('/api/admin/push-test', pin, {
    method: 'POST',
    body: JSON.stringify(subscription)
  });
}

export async function fetchGallery() {
  const response = await fetch(`${API_URL}/api/gallery`);

  if (!response.ok) {
    throw new Error('No pudimos cargar la galería.');
  }

  return response.json() as Promise<{ configured: boolean; items: GalleryEntry[] }>;
}

export async function fetchAdminGallery(pin: string) {
  return adminFetch<{ items: GalleryEntry[] }>('/api/admin/gallery', pin);
}

export async function requestGalleryUploadUrl(pin: string, payload: {
  kind: 'photo' | 'poster' | 'video';
  contentType: string;
  size: number;
}) {
  return adminFetch<{ path: string; signedUrl: string }>('/api/admin/gallery/upload-url', pin, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// Sube el archivo directo a Supabase Storage con la URL firmada del backend,
// asi videos grandes no pasan por el limite de tamano de la funcion.
export async function uploadToSignedUrl(signedUrl: string, file: Blob) {
  const body = new FormData();
  body.append('cacheControl', '31536000');
  body.append('', file);

  let response: Response;

  try {
    response = await fetch(signedUrl, { method: 'PUT', headers: { 'x-upsert': 'false' }, body });
  } catch {
    throw new Error('No pudimos subir el archivo. Revisá la conexión e intentá de nuevo.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? 'Supabase rechazó el archivo.');
  }
}

export async function createAdminGalleryItem(pin: string, payload: {
  mediaType: GalleryMediaType;
  storagePath: string;
  posterPath?: string | null;
  alt: string;
}) {
  return adminFetch<{ item: GalleryEntry }>('/api/admin/gallery', pin, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAdminGalleryItem(pin: string, id: string, payload: { alt?: string; isActive?: boolean }) {
  return adminFetch<{ item: GalleryEntry }>(`/api/admin/gallery/${id}`, pin, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function reorderAdminGallery(pin: string, ids: string[]) {
  return adminFetch<{ items: GalleryEntry[] }>('/api/admin/gallery/order', pin, {
    method: 'PUT',
    body: JSON.stringify({ ids })
  });
}

export async function deleteAdminGalleryItem(pin: string, id: string) {
  return adminFetch(`/api/admin/gallery/${id}`, pin, {
    method: 'DELETE'
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
