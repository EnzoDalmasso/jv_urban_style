import webPush from 'web-push';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { env } from '../config/env.js';
import { supabase } from '../lib/supabase.js';
import { HttpError } from '../utils/httpError.js';
import { isMissingSchemaError } from '../utils/supabaseError.js';

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

type NewAppointmentPushInput = {
  clientName: string;
  startsAt: string;
  services: Array<{ name: string }>;
  depositRequired: boolean;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

let configured = false;

function configureWebPush() {
  if (configured) {
    return true;
  }

  if (!env.WEB_PUSH_PUBLIC_KEY || !env.WEB_PUSH_PRIVATE_KEY) {
    return false;
  }

  webPush.setVapidDetails(
    env.WEB_PUSH_SUBJECT,
    env.WEB_PUSH_PUBLIC_KEY,
    env.WEB_PUSH_PRIVATE_KEY
  );
  configured = true;
  return true;
}

export function getPushPublicConfig() {
  return {
    publicKey: env.WEB_PUSH_PUBLIC_KEY ?? '',
    enabled: Boolean(env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY)
  };
}

export async function savePushSubscription(rawInput: unknown, userAgent?: string) {
  const subscription = pushSubscriptionSchema.parse(rawInput);

  if (!supabase) {
    return { saved: true };
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent ?? null,
      last_seen_at: new Date().toISOString()
    }, { onConflict: 'endpoint' })
    .select('id')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      throw new HttpError(409, 'Falta ejecutar la migracion SQL de notificaciones push en Supabase.', error);
    }

    throw new HttpError(502, 'No se pudo guardar el dispositivo para notificaciones.', error);
  }

  return { saved: true, id: data?.id };
}

export async function sendNewAppointmentPush(input: NewAppointmentPushInput) {
  const startsAt = DateTime.fromISO(input.startsAt)
    .setZone(env.BUSINESS_TIMEZONE)
    .toFormat('dd/MM HH:mm');
  const serviceText = input.services.map((service) => service.name).join(', ');

  return sendPushToSavedDevices({
    title: 'Nuevo turno solicitado',
    body: `${input.clientName} pidio ${serviceText} para ${startsAt}. ${input.depositRequired ? 'Pendiente de sena.' : 'Pendiente de aceptacion.'}`,
    url: '/admin',
    tag: `new-appointment-${input.startsAt}`
  });
}

export async function sendTestPush() {
  return sendPushToSavedDevices({
    title: 'Notificaciones activas',
    body: 'Este dispositivo ya puede recibir avisos de nuevos turnos.',
    url: '/admin',
    tag: `push-test-${Date.now()}`
  });
}

export async function sendTestPushToSubscription(rawInput: unknown) {
  const subscription = pushSubscriptionSchema.parse(rawInput);

  return sendPushToSavedDevices({
    title: 'Notificaciones activas',
    body: 'Este dispositivo ya puede recibir avisos de nuevos turnos.',
    url: '/admin',
    tag: `push-test-${Date.now()}`
  }, [subscription]);
}

async function sendPushToSavedDevices(payloadInput: PushPayload, directSubscriptions?: PushSubscriptionInput[]) {
  if (!configureWebPush() || !supabase) {
    return { sent: 0, failed: 0, error: 'Faltan claves WEB_PUSH en Render.' };
  }

  const supabaseClient = supabase;
  let subscriptions: Array<PushSubscriptionRow | PushSubscriptionInput> = directSubscriptions ?? [];

  if (!directSubscriptions) {
    const { data, error } = await supabaseClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .returns<PushSubscriptionRow[]>();

    if (error) {
      if (isMissingSchemaError(error)) {
        throw new HttpError(409, 'Falta ejecutar la migracion SQL de notificaciones push en Supabase.', error);
      }

      console.warn('No se pudieron obtener suscripciones push.', error);
      return { sent: 0, failed: 1, error: error.message };
    }

    subscriptions = data ?? [];
  }

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, error: 'No hay dispositivos guardados.' };
  }

  const payload = JSON.stringify(payloadInput);
  const results = await Promise.allSettled(subscriptions.map((row) => (
    webPush.sendNotification({
      endpoint: row.endpoint,
      keys: {
        p256dh: 'keys' in row ? row.keys.p256dh : row.p256dh,
        auth: 'keys' in row ? row.keys.auth : row.auth
      }
    }, payload)
  )));

  await Promise.all(results.map(async (result, index) => {
    if (result.status === 'fulfilled') {
      return;
    }

    const row = subscriptions[index];
    const error = result.reason;

    if ('id' in row && (error?.statusCode === 404 || error?.statusCode === 410)) {
      await supabaseClient.from('push_subscriptions').delete().eq('id', row.id);
    } else {
      console.warn('No se pudo enviar notificacion push.', error);
    }
  }));

  return {
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
    error: results.find((result) => result.status === 'rejected')?.reason?.message
  };
}
