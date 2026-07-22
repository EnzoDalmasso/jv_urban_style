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
