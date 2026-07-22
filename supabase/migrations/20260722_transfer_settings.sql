alter table public.shop_settings
  add column if not exists transfer_holder text not null default 'JV Urban Style Barberia',
  add column if not exists transfer_alias text not null default 'JVURBANSTYLE',
  add column if not exists transfer_cbu text not null default 'Configurar en admin';

update public.shop_settings
set transfer_holder = coalesce(nullif(transfer_holder, ''), 'JV Urban Style Barberia'),
    transfer_alias = coalesce(nullif(transfer_alias, ''), 'JVURBANSTYLE'),
    transfer_cbu = coalesce(nullif(transfer_cbu, ''), 'Configurar en admin')
where id = true;
