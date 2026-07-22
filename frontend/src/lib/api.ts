import type { AvailabilityResponse, Service } from '../types';

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
