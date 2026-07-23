import { DateTime } from 'luxon';
import { z } from 'zod';
import { env } from '../config/env.js';
import { supabase } from '../lib/supabase.js';
import { calculateAvailability, getActiveServicesByIds } from './availability.service.js';
import { defaultSettings, getShopSettings } from './settings.service.js';
import { HttpError } from '../utils/httpError.js';
import { isMissingSchemaError } from '../utils/supabaseError.js';
import { sendNewAppointmentPush } from './push.service.js';

const createAppointmentSchema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1),
  staffId: z.string().uuid(),
  startsAt: z.string().datetime(),
  client: z.object({
    firstName: z.string().trim().min(2),
    lastName: z.string().trim().min(2),
    phone: z.string().trim().min(6),
    email: z.string().trim().email().optional().or(z.literal('')),
    notes: z.string().trim().optional()
  }),
  notes: z.string().trim().optional()
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export async function createAppointment(rawInput: unknown) {
  const input = createAppointmentSchema.parse(rawInput);
  const startsAt = DateTime.fromISO(input.startsAt, { setZone: true });

  if (!startsAt.isValid) {
    throw new HttpError(400, 'Horario invalido.');
  }

  const date = startsAt.setZone(env.BUSINESS_TIMEZONE).toISODate();

  if (!date) {
    throw new HttpError(400, 'Fecha invalida.');
  }

  const availability = await calculateAvailability({
    date,
    serviceIds: input.serviceIds,
    staffId: input.staffId
  });

  const requestedStart = startsAt.toUTC().toMillis();
  const matchingSlot = availability.slots.find((slot) => (
    DateTime.fromISO(slot.startsAt).toUTC().toMillis() === requestedStart
      && slot.staffId === input.staffId
  ));

  if (!matchingSlot) {
    throw new HttpError(409, 'Ese horario no esta dentro de la agenda disponible.');
  }

  if (!matchingSlot.isAvailable) {
    throw new HttpError(409, 'Ese turno ya esta reservado.');
  }

  if (!supabase) {
    return buildDemoAppointmentResponse(input, matchingSlot);
  }

  const services = await getActiveServicesByIds(input.serviceIds);
  const totalDuration = services.reduce((sum, service) => sum + Number(service.duration_minutes), 0);
  const totalPrice = services.reduce((sum, service) => sum + Number(service.price), 0);
  const settings = await getShopSettings();
  const depositRequired = Boolean(settings.require_deposit_for_late_cancellation);
  const depositAmount = roundMoney(totalPrice * (Number(settings.deposit_percentage) / 100));
  const cancellationCutoffAt = startsAt
    .minus({ minutes: Number(settings.cancellation_notice_minutes) })
    .toUTC()
    .toISO();
  const transfer = buildTransferDetails(settings);

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      first_name: input.client.firstName,
      last_name: input.client.lastName,
      phone: input.client.phone,
      email: input.client.email || null,
      notes: input.client.notes || null
    })
    .select('id')
    .single<{ id: string }>();

  if (clientError || !client) {
    throw new HttpError(502, 'No se pudo crear el cliente.', clientError);
  }

  const baseAppointmentPayload = {
    client_id: client.id,
    staff_id: input.staffId,
    starts_at: matchingSlot.startsAt,
    ends_at: matchingSlot.endsAt,
    status: 'pending',
    notes: input.notes || null,
    total_duration_minutes: totalDuration,
    total_price: totalPrice
  };

  const appointmentPayload = {
    ...baseAppointmentPayload,
    deposit_required: depositRequired,
    deposit_amount: depositRequired ? depositAmount : 0,
    deposit_status: depositRequired ? 'pending' : 'not_required',
    cancellation_cutoff_at: cancellationCutoffAt
  };

  let { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .insert(appointmentPayload)
    .select('id, public_code, starts_at, ends_at, total_price, deposit_required, deposit_amount, deposit_status')
    .single();

  if (appointmentError && isMissingSchemaError(appointmentError)) {
    const retry = await supabase
      .from('appointments')
      .insert(baseAppointmentPayload)
      .select('id, public_code, starts_at, ends_at, total_price')
      .single();

    appointment = retry.data
      ? {
          ...retry.data,
          deposit_required: depositRequired,
          deposit_amount: depositRequired ? depositAmount : 0,
          deposit_status: depositRequired ? 'pending' : 'not_required'
        }
      : null;
    appointmentError = retry.error;
  }

  if (appointmentError || !appointment) {
    throw new HttpError(409, 'No se pudo reservar el turno. Es posible que alguien haya tomado ese horario.', appointmentError);
  }

  const appointmentServices = services.map((service, index) => ({
    appointment_id: appointment.id,
    service_id: service.id,
    position: index + 1,
    service_name_at_booking: service.name,
    duration_minutes: Number(service.duration_minutes),
    price_at_booking: Number(service.price)
  }));

  const { error: appointmentServicesError } = await supabase
    .from('appointment_services')
    .insert(appointmentServices);

  if (appointmentServicesError) {
    await supabase.from('appointments').delete().eq('id', appointment.id);
    throw new HttpError(502, 'No se pudieron asociar los servicios al turno.', appointmentServicesError);
  }

  try {
    await sendNewAppointmentPush({
      clientName: `${input.client.firstName} ${input.client.lastName}`.trim(),
      startsAt: appointment.starts_at,
      services,
      depositRequired
    });
  } catch (error) {
    console.warn('No se pudo enviar la notificacion push de nuevo turno.', error);
  }

  return {
    appointment: {
      publicCode: appointment.public_code,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      staffName: matchingSlot.staffName,
      totalPrice,
      depositRequired: appointment.deposit_required,
      depositAmount: Number(appointment.deposit_amount),
      depositStatus: appointment.deposit_status,
      cancellationCutoffAt,
      transfer,
      businessWhatsappPhone: settings.whatsapp_phone || ''
    }
  };
}

export async function cancelAppointment(publicCode: string) {
  if (!supabase) {
    return { cancelled: true };
  }

  const { data: appointment, error } = await supabase
    .from('appointments')
    .select('id, starts_at, status, deposit_required, deposit_amount, cancellation_cutoff_at')
    .eq('public_code', publicCode.toUpperCase())
    .maybeSingle();

  if (error) {
    throw new HttpError(502, 'No se pudo buscar el turno.', error);
  }

  if (!appointment) {
    throw new HttpError(404, 'Turno no encontrado.');
  }

  if (appointment.status === 'cancelled') {
    return { cancelled: true };
  }

  const cutoff = appointment.cancellation_cutoff_at
    ? DateTime.fromISO(appointment.cancellation_cutoff_at)
    : DateTime.fromISO(appointment.starts_at).minus({ minutes: 120 });

  if (DateTime.utc() >= cutoff.toUTC()) {
    throw new HttpError(409, 'No se puede cancelar online dentro del plazo mínimo. Contactá al local para resolver la seña.', {
      depositRequired: appointment.deposit_required,
      depositAmount: appointment.deposit_amount
    });
  }

  const { error: updateError } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointment.id);

  if (updateError) {
    throw new HttpError(502, 'No se pudo cancelar el turno.', updateError);
  }

  return { cancelled: true };
}

function buildDemoAppointmentResponse(input: CreateAppointmentInput, slot: { startsAt: string; endsAt: string; staffName: string }) {
  return {
    appointment: {
      publicCode: 'DEMO1234',
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      staffName: slot.staffName,
      totalPrice: input.serviceIds.length * 9500,
      depositRequired: true,
      depositAmount: input.serviceIds.length * 4750,
      depositStatus: 'pending',
      cancellationCutoffAt: DateTime.fromISO(slot.startsAt).minus({ minutes: 120 }).toUTC().toISO(),
      transfer: buildTransferDetails(defaultSettings),
      businessWhatsappPhone: defaultSettings.whatsapp_phone
    }
  };
}

function buildTransferDetails(settings: {
  transfer_holder?: string | null;
  transfer_alias?: string | null;
  transfer_cbu?: string | null;
}) {
  return {
    holder: settings.transfer_holder || defaultSettings.transfer_holder,
    alias: settings.transfer_alias || defaultSettings.transfer_alias,
    cbu: settings.transfer_cbu || defaultSettings.transfer_cbu
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
