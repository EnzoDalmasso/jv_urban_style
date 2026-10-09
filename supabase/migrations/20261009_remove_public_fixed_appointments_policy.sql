-- Los turnos fijos incluyen client_name y note: no deben ser legibles con la anon key.
-- El backend los lee con SUPABASE_SERVICE_ROLE_KEY, que no depende de esta policy.
drop policy if exists "Public can read active fixed appointments" on public.fixed_appointments;
