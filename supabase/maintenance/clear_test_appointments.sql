-- Ejecutar manualmente en Supabase SQL Editor solo para limpiar pruebas.
-- Borra los turnos del cliente de prueba indicado y, si quedo sin turnos, el cliente.
-- Antes de correrlo, reemplazar el nombre ('cliente' / 'prueba') y los telefonos de ejemplo por los reales.
-- appointment_services se borra solo porque tiene ON DELETE CASCADE.

begin;

with target_clients as (
  select id
  from public.clients
  where (lower(trim(first_name)) = 'cliente' and lower(trim(last_name)) = 'prueba')
     or regexp_replace(coalesce(phone, ''), '\D', '', 'g') in ('3510000000', '5493510000000')
)
delete from public.appointments appointment
using target_clients client
where appointment.client_id = client.id
returning appointment.id, appointment.starts_at, appointment.status;

with target_clients as (
  select id
  from public.clients
  where (lower(trim(first_name)) = 'cliente' and lower(trim(last_name)) = 'prueba')
     or regexp_replace(coalesce(phone, ''), '\D', '', 'g') in ('3510000000', '5493510000000')
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
