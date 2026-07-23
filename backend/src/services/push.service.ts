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

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NewAppointmentPushInput = {
  clientName: string;
  startsAt: string;
  services: Array<{ name: string }>;
  depositRequired: boolean;
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
  if (!configureWebPush() || !supabase) {
    return;
  }

  const supabaseClient = supabase;
  const { data, error } = await supabaseClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .returns<PushSubscriptionRow[]>();

  if (error) {
    if (!isMissingSchemaError(error)) {
      console.warn('No se pudieron obtener suscripciones push.', error);
    }
    return;
  }

  const subscriptions = data ?? [];
  if (subscriptions.length === 0) {
    return;
  }

  const startsAt = DateTime.fromISO(input.startsAt)
    .setZone(env.BUSINESS_TIMEZONE)
    .toFormat('dd/MM HH:mm');
  const serviceText = input.services.map((service) => service.name).join(', ');
  const payload = JSON.stringify({
    title: 'Nuevo turno solicitado',
    body: `${input.clientName} pidió ${serviceText} para ${startsAt}. ${input.depositRequired ? 'Pendiente de seña.' : 'Pendiente de aceptación.'}`,
    url: '/admin',
    tag: `new-appointment-${input.startsAt}`
  });

  await Promise.allSettled(subscriptions.map(async (row) => {
    try {
      await webPush.sendNotification({
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth
        }
      }, payload);
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await supabaseClient.from('push_subscriptions').delete().eq('id', row.id);
      } else {
        console.warn('No se pudo enviar notificacion push.', error);
      }
    }
  }));
}
