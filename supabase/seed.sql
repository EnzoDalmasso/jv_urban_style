with seed_services (name, description, duration_minutes, price, sort_order) as (
  values
    ('Corte urbano', 'Fade, tijera y terminacion con navaja.', 45, 9500, 1),
    ('Barba premium', 'Perfilado, vapor y producto final.', 30, 6500, 2),
    ('Corte + barba', 'Servicio completo con terminacion prolija.', 75, 14500, 3),
    ('Color express', 'Tono, matiz o cobertura rapida.', 60, 18000, 4)
)
insert into public.services (name, description, duration_minutes, price, sort_order)
select name, description, duration_minutes, price, sort_order
from seed_services source
where not exists (
  select 1 from public.services existing
  where lower(existing.name) = lower(source.name)
);

with seed_staff (full_name, role, bio) as (
  values
    ('Joel', 'barber', 'Especialista en cortes urbanos y fades.'),
    ('Gino', 'barber', 'Barbería clásica, perfilado y terminaciones limpias.')
)
insert into public.staff (full_name, role, bio)
select full_name, role, bio
from seed_staff source
where not exists (
  select 1 from public.staff existing
  where lower(existing.full_name) = lower(source.full_name)
);

insert into public.staff_services (staff_id, service_id)
select st.id, sv.id
from public.staff st
cross join public.services sv
where st.full_name in ('Joel', 'Gino')
on conflict do nothing;

update public.staff
set full_name = 'Joel',
    bio = 'Especialista en cortes urbanos y fades.'
where full_name = 'Nico Vega';

update public.staff
set full_name = 'Gino',
    role = 'barber',
    bio = 'Barbería clásica, perfilado y terminaciones limpias.'
where full_name = 'Lara Cruz';

insert into public.staff_services (staff_id, service_id)
select st.id, sv.id
from public.staff st
cross join public.services sv
where st.full_name in ('Joel', 'Gino')
on conflict do nothing;

insert into public.business_hours (staff_id, day_of_week, opens_at, closes_at, is_closed)
select null, days.day_number, time '10:00', time '19:00', false
from generate_series(1, 6) as days(day_number)
where not exists (
  select 1 from public.business_hours existing
  where existing.staff_id is null
    and existing.day_of_week = days.day_number
);

insert into public.business_hours (staff_id, day_of_week, opens_at, closes_at, is_closed)
select null, 0, time '10:00', time '14:00', true
where not exists (
  select 1 from public.business_hours existing
  where existing.staff_id is null
    and existing.day_of_week = 0
);
