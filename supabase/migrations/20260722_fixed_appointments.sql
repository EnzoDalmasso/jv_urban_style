create extension if not exists pgcrypto;

create table if not exists public.fixed_appointments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  client_name text not null,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fixed_appointments_lookup_idx
  on public.fixed_appointments (staff_id, day_of_week, starts_at)
  where is_active = true;

create unique index if not exists fixed_appointments_staff_day_start_unique_idx
  on public.fixed_appointments (staff_id, day_of_week, starts_at)
  where is_active = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fixed_appointments_set_updated_at on public.fixed_appointments;
create trigger fixed_appointments_set_updated_at
before update on public.fixed_appointments
for each row execute function public.set_updated_at();

alter table public.fixed_appointments enable row level security;

drop policy if exists "Public can read active fixed appointments" on public.fixed_appointments;
create policy "Public can read active fixed appointments"
on public.fixed_appointments for select
to anon, authenticated
using (is_active = true);

notify pgrst, 'reload schema';
