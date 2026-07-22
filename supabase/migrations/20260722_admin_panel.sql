create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.shop_settings (
  id boolean primary key default true,
  cancellation_notice_minutes integer not null default 120 check (cancellation_notice_minutes >= 0),
  deposit_percentage numeric(5,2) not null default 50 check (deposit_percentage >= 0 and deposit_percentage <= 100),
  require_deposit_for_late_cancellation boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint shop_settings_singleton check (id)
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

alter table public.appointments
  add column if not exists deposit_required boolean not null default false,
  add column if not exists deposit_amount numeric(10,2) not null default 0 check (deposit_amount >= 0),
  add column if not exists deposit_status text not null default 'not_required',
  add column if not exists cancellation_cutoff_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_deposit_status_valid'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_deposit_status_valid
      check (deposit_status in ('not_required', 'pending', 'paid', 'waived'));
  end if;
end $$;

create unique index if not exists special_business_hours_staff_date_unique_idx
  on public.special_business_hours (staff_id, date)
  where staff_id is not null;

create unique index if not exists special_business_hours_global_date_unique_idx
  on public.special_business_hours (date)
  where staff_id is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

alter table public.shop_settings enable row level security;
alter table public.special_business_hours enable row level security;

drop policy if exists "Public can read special business hours" on public.special_business_hours;
create policy "Public can read special business hours"
on public.special_business_hours for select
to anon, authenticated
using (true);
