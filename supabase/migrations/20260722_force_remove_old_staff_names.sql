update public.staff
set full_name = 'Joel',
    role = 'barber',
    bio = 'Especialista en cortes urbanos y fades.',
    is_active = true
where lower(trim(full_name)) like '%nico%';

update public.staff
set full_name = 'Gino',
    role = 'barber',
    bio = 'Barberia clasica, perfilado y terminaciones limpias.',
    is_active = true
where lower(trim(full_name)) like '%lara%';

insert into public.staff_services (staff_id, service_id)
select st.id, sv.id
from public.staff st
cross join public.services sv
where st.full_name in ('Joel', 'Gino')
on conflict do nothing;
