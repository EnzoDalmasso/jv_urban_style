import { DateTime } from 'luxon';
import { env } from '../config/env.js';

type AppointmentNotificationInput = {
  clientName: string;
  clientPhone: string;
  startsAt: string;
};

type WhatsAppPayload = {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    preview_url: boolean;
    body: string;
  };
};

export async function sendAppointmentRequestedNotification(input: AppointmentNotificationInput) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return { sent: false, reason: 'missing_whatsapp_env' as const };
  }

  const phone = normalizeArgentinaPhone(input.clientPhone);

  if (!phone) {
    return { sent: false, reason: 'invalid_phone' as const };
  }

  const body = buildAppointmentRequestedMessage(input.clientName, input.startsAt);
  const payload: WhatsAppPayload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: {
      preview_url: false,
      body
    }
  };

  const response = await fetch(
    `https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.warn('No se pudo enviar WhatsApp automatico de reserva.', {
      status: response.status,
      details
    });

    return { sent: false, reason: 'whatsapp_api_error' as const };
  }

  return { sent: true as const };
}

function buildAppointmentRequestedMessage(clientName: string, startsAt: string) {
  const date = DateTime.fromISO(startsAt)
    .setZone(env.BUSINESS_TIMEZONE)
    .setLocale('es-AR');

  const formattedDate = date.toFormat("dd/MM/yyyy 'a las' HH:mm");

  return [
    `Hola ${clientName}, recibimos tu solicitud de turno en JV Urban Style para el ${formattedDate}.`,
    'Queda a la espera de que el dueño de la peluquería lo acepte.',
    'Te avisamos por WhatsApp cuando esté confirmado.'
  ].join(' ');
}

function normalizeArgentinaPhone(value: string) {
  let digits = value.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }

  if (digits.startsWith('54')) {
    return digits;
  }

  if (digits.length >= 10 && digits.length <= 11) {
    return `549${digits}`;
  }

  return digits;
}
