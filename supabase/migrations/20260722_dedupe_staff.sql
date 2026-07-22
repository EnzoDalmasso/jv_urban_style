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

with ranked as (
  select
    id,
    lower(trim(full_name)) as staff_key,
    row_number() over (
      partition by lower(trim(full_name))
      order by created_at asc nulls last, id asc
    ) as row_number
  from public.staff
  where lower(trim(full_name)) in ('joel', 'gino')
)
update public.staff staff
set is_active = (ranked.row_number = 1)
from ranked
where staff.id = ranked.id;

insert into public.staff_services (staff_id, service_id)
select staff.id, services.id
from public.staff staff
cross join public.services services
where staff.full_name in ('Joel', 'Gino')
  and staff.is_active = true
  and services.is_active = true
on conflict do nothing;

select id, full_name, role, is_active
from public.staff
order by full_name, is_active desc;
