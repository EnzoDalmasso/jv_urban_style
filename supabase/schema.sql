create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type appointment_status as enum (
      'pending',
      'confirmed',
      'cancelled',
      'completed',
      'no_show'
    );
  end if;
end $$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(10,2) not null check (price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text not null default 'barber',
  bio text,
  avatar_url text,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_services (
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (staff_id, service_id)
);

create table if not exists public.shop_settings (
  id boolean primary key default true,
  cancellation_notice_minutes integer not null default 120 check (cancellation_notice_minutes >= 0),
  deposit_percentage numeric(5,2) not null default 50 check (deposit_percentage >= 0 and deposit_percentage <= 100),
  require_deposit_for_late_cancellation boolean not null default true,
  transfer_holder text not null default 'JV Urban Style Barberia',
  transfer_alias text not null default 'JVURBANSTYLE',
  transfer_cbu text not null default 'Configurar en admin',
  whatsapp_phone text not null default '',
  updated_at timestamptz not null default now(),
  constraint shop_settings_singleton check (id)
);

create table if not exists public.business_hours (
  id bigserial primary key,
  staff_id uuid references public.staff(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  is_closed boolean not null default false,
  constraint business_hours_valid_range check (opens_at < closes_at)
);

create table if not exists public.special_business_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff(id) on delete cascade,
  date date not null,
  opens_at time not null default time '10:00',
  closes_at time not null default time '19:00',
  is_closed boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_business_hours_valid_range check (is_closed = true or opens_at < closes_at)
);

create table if not exists public.time_off (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint time_off_valid_range check (starts_at < ends_at)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'pending',
  public_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  notes text,
  total_duration_minutes integer not null check (total_duration_minutes > 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  deposit_required boolean not null default false,
  deposit_amount numeric(10,2) not null default 0 check (deposit_amount >= 0),
  deposit_status text not null default 'not_required'
    check (deposit_status in ('not_required', 'pending', 'paid', 'waived')),
  cancellation_cutoff_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_valid_range check (starts_at < ends_at),
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('pending', 'confirmed'))
);

create table if not exists public.appointment_services (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  position smallint not null default 1,
  service_name_at_booking text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price_at_booking numeric(10,2) not null check (price_at_booking >= 0),
  primary key (appointment_id, service_id)
);

create index if not exists services_active_sort_idx
  on public.services (is_active, sort_order, name);

create index if not exists staff_active_name_idx
  on public.staff (is_active, full_name);

create unique index if not exists business_hours_staff_day_unique_idx
  on public.business_hours (staff_id, day_of_week)
  where staff_id is not null;

create unique index if not exists business_hours_global_day_unique_idx
  on public.business_hours (day_of_week)
  where staff_id is null;

create unique index if not exists special_business_hours_staff_date_unique_idx
  on public.special_business_hours (staff_id, date)
  where staff_id is not null;

create unique index if not exists special_business_hours_global_date_unique_idx
  on public.special_business_hours (date)
  where staff_id is null;

create index if not exists appointments_staff_time_idx
  on public.appointments (staff_id, starts_at, ends_at)
  where status in ('pending', 'confirmed');

create index if not exists appointments_day_lookup_idx
  on public.appointments (starts_at, ends_at, status);

create index if not exists time_off_staff_time_idx
  on public.time_off (staff_id, starts_at, ends_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists shop_settings_set_updated_at on public.shop_settings;
create trigger shop_settings_set_updated_at
before update on public.shop_settings
for each row execute function public.set_updated_at();

drop trigger if exists special_business_hours_set_updated_at on public.special_business_hours;
create trigger special_business_hours_set_updated_at
before update on public.special_business_hours
for each row execute function public.set_updated_at();

insert into public.shop_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.staff enable row level security;
alter table public.staff_services enable row level security;
alter table public.shop_settings enable row level security;
alter table public.business_hours enable row level security;
alter table public.special_business_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;

drop policy if exists "Public can read active services" on public.services;
create policy "Public can read active services"
on public.services for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Public can read active staff" on public.staff;
create policy "Public can read active staff"
on public.staff for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Public can read staff services" on public.staff_services;
create policy "Public can read staff services"
on public.staff_services for select
to anon, authenticated
using (true);

drop policy if exists "Public can read business hours" on public.business_hours;
create policy "Public can read business hours"
on public.business_hours for select
to anon, authenticated
using (true);

drop policy if exists "Public can read special business hours" on public.special_business_hours;
create policy "Public can read special business hours"
on public.special_business_hours for select
to anon, authenticated
using (true);

-- Reservas, clientes, bloqueos y dashboard deben escribirse/consultarse via backend
-- usando SUPABASE_SERVICE_ROLE_KEY. La service role bypassa RLS.
