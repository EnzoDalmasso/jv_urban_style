-- Galeria de trabajos administrable desde el panel.
-- Los archivos viven en el bucket publico "gallery" de Supabase Storage; esta tabla
-- guarda que se muestra, en que orden y con que descripcion.

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  media_type text not null check (media_type in ('photo', 'video')),
  storage_path text not null unique,
  poster_path text,
  alt text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gallery_items_order_idx
  on public.gallery_items (sort_order, created_at);

-- Sin policies: solo el backend (service role) lee y escribe la tabla.
alter table public.gallery_items enable row level security;

drop trigger if exists gallery_items_set_updated_at on public.gallery_items;
create trigger gallery_items_set_updated_at
before update on public.gallery_items
for each row execute function public.set_updated_at();

-- Bucket publico: cualquiera puede ver los archivos (son la galeria de la web),
-- pero solo se puede subir con URLs firmadas que genera el backend.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  true,
  52428800,
  array['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
