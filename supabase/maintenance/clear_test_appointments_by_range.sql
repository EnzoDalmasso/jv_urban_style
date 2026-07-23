-- Ejecutar manualmente en Supabase SQL Editor solo para limpiar pruebas.
-- Ajustar start_date, end_date, test_phones y test_names antes de correrlo.
-- Borra turnos de prueba dentro del rango inclusive y libera esos horarios.
--
-- Vista previa recomendada antes de borrar:
-- with cleanup_settings as (
--   select
--     date '2026-07-22' as start_date,
--     date '2026-07-31' as end_date,
--     array['3471314256', '5493471314256']::text[] as test_phones,
--     array['enzo dalmasso', 'enzo villarroel', 'joel villarroel']::text[] as test_names
-- )
-- select appointment.id, appointment.starts_at, appointment.status, client.first_name, client.last_name, client.phone
-- from public.appointments appointment
-- join public.clients client on client.id = appointment.client_id
-- cross join cleanup_settings settings
-- where appointment.starts_at >= (settings.start_date::timestamp at time zone 'America/Argentina/Buenos_Aires')
--   and appointment.starts_at < ((settings.end_date + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
--   and (
--     regexp_replace(coalesce(client.phone, ''), '\D', '', 'g') = any(settings.test_phones)
--     or lower(trim(client.first_name || ' ' || client.last_name)) = any(settings.test_names)
--   )
-- order by appointment.starts_at;

begin;

with cleanup_settings as (
  select
    date '2026-07-22' as start_date,
    date '2026-07-31' as end_date,
    array[
      '3471314256',
      '5493471314256'
    ]::text[] as test_phones,
    array[
      'enzo dalmasso',
      'enzo villarroel',
      'joel villarroel'
    ]::text[] as test_names
),
target_appointments as (
  select appointment.id
  from public.appointments appointment
  join public.clients client on client.id = appointment.client_id
  cross join cleanup_settings settings
  where appointment.starts_at >= (settings.start_date::timestamp at time zone 'America/Argentina/Buenos_Aires')
    and appointment.starts_at < ((settings.end_date + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
    and (
      regexp_replace(coalesce(client.phone, ''), '\D', '', 'g') = any(settings.test_phones)
      or lower(trim(client.first_name || ' ' || client.last_name)) = any(settings.test_names)
    )
)
delete from public.appointments appointment
using target_appointments target
where appointment.id = target.id
returning appointment.id, appointment.starts_at, appointment.status;

commit;
