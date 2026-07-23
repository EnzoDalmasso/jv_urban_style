-- Ejecutar manualmente en Supabase SQL Editor solo cuando quieras limpiar todo el historial.
-- Borra todos los turnos, sus servicios asociados y luego elimina clientes que quedaron sin turnos.
-- No borra servicios, profesionales, horarios, turnos fijos, feriados ni configuraciones.
--
-- Vista previa antes de borrar:
-- select
--   appointment.id,
--   appointment.starts_at,
--   appointment.status,
--   client.first_name,
--   client.last_name,
--   client.phone
-- from public.appointments appointment
-- left join public.clients client on client.id = appointment.client_id
-- order by appointment.starts_at;

begin;

delete from public.appointments
returning id, starts_at, status;

delete from public.clients client
where not exists (
  select 1
  from public.appointments appointment
  where appointment.client_id = client.id
)
returning id, first_name, last_name, phone;

commit;
