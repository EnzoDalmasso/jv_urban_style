-- Ejecutar manualmente en Supabase SQL Editor solo para limpiar pruebas.
-- Borra turnos asociados al cliente de prueba Enzo Dalmasso / 3471314256.
-- appointment_services se borra solo porque tiene ON DELETE CASCADE.

begin;

with target_clients as (
  select id
  from public.clients
  where (lower(trim(first_name)) = 'enzo' and lower(trim(last_name)) = 'dalmasso')
     or regexp_replace(coalesce(phone, ''), '\D', '', 'g') in ('3471314256', '5493471314256')
)
delete from public.appointments appointment
using target_clients client
where appointment.client_id = client.id
returning appointment.id, appointment.starts_at, appointment.status;

with target_clients as (
  select id
  from public.clients
  where (lower(trim(first_name)) = 'enzo' and lower(trim(last_name)) = 'dalmasso')
     or regexp_replace(coalesce(phone, ''), '\D', '', 'g') in ('3471314256', '5493471314256')
)
delete from public.clients client
using target_clients target
where client.id = target.id
  and not exists (
    select 1
    from public.appointments appointment
    where appointment.client_id = client.id
  )
returning client.id, client.first_name, client.last_name, client.phone;

commit;
