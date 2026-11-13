import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { HttpError } from '../utils/httpError.js';
import { isMissingSchemaError } from '../utils/supabaseError.js';

const BUCKET = 'gallery';
const MB = 1024 * 1024;

// Que se puede subir y con que limite. El bucket repite tipos y tope (50 MB) como segunda barrera.
const uploadKinds = {
  photo: { folder: 'photos', maxBytes: 10 * MB, types: { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' } },
  poster: { folder: 'posters', maxBytes: 2 * MB, types: { 'image/webp': 'webp', 'image/jpeg': 'jpg' } },
  video: { folder: 'videos', maxBytes: 50 * MB, types: { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' } }
} as const;

const mediaPathSchema = z.string().regex(/^(photos|videos)\/[0-9a-f-]{36}\.(webp|jpg|png|mp4|mov|webm)$/);
const posterPathSchema = z.string().regex(/^posters\/[0-9a-f-]{36}\.(webp|jpg)$/);

export const createUploadUrlSchema = z.object({
  kind: z.enum(['photo', 'poster', 'video']),
  contentType: z.string(),
  size: z.number().int().positive()
});

export const createGalleryItemSchema = z.object({
  mediaType: z.enum(['photo', 'video']),
  storagePath: mediaPathSchema,
  posterPath: posterPathSchema.nullable().optional(),
  alt: z.string().trim().max(160).default('')
});

export const updateGalleryItemSchema = z.object({
  alt: z.string().trim().max(160).optional(),
  isActive: z.boolean().optional()
});

export const reorderGallerySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200)
});

type GalleryRow = {
  id: string;
  media_type: 'photo' | 'video';
  storage_path: string;
  poster_path: string | null;
  alt: string;
  sort_order: number;
  is_active: boolean;
};

const gallerySelect = 'id, media_type, storage_path, poster_path, alt, sort_order, is_active';

function requireSupabase() {
  if (!supabase) {
    throw new HttpError(503, 'La galería necesita Supabase configurado en el backend.');
  }

  return supabase;
}

function publicUrl(path: string) {
  return requireSupabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function toGalleryItem(row: GalleryRow) {
  return {
    id: row.id,
    mediaType: row.media_type,
    url: publicUrl(row.storage_path),
    posterUrl: row.poster_path ? publicUrl(row.poster_path) : null,
    alt: row.alt,
    sortOrder: row.sort_order,
    isActive: row.is_active
  };
}

function missingGalleryError(error: unknown) {
  return new HttpError(409, 'Falta ejecutar la migración SQL de la galería en Supabase.', error);
}

async function listRows(onlyActive: boolean) {
  let query = requireSupabase()
    .from('gallery_items')
    .select(gallerySelect)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (onlyActive) {
    query = query.eq('is_active', true);
  }

  return query.returns<GalleryRow[]>();
}

// Publico. "configured: false" le indica al sitio que use la galeria incluida en el build.
export async function listPublicGallery() {
  if (!supabase) {
    return { configured: false, items: [] };
  }

  const { data, error } = await listRows(true);

  if (error) {
    if (isMissingSchemaError(error)) {
      return { configured: false, items: [] };
    }

    throw new HttpError(502, 'No se pudo obtener la galería.', error);
  }

  return { configured: true, items: (data ?? []).map(toGalleryItem) };
}

export async function listAdminGallery() {
  const { data, error } = await listRows(false);

  if (error) {
    throw isMissingSchemaError(error) ? missingGalleryError(error) : new HttpError(502, 'No se pudo obtener la galería.', error);
  }

  return (data ?? []).map(toGalleryItem);
}

export async function createUploadUrl(rawInput: unknown) {
  const input = createUploadUrlSchema.parse(rawInput);
  const kind = uploadKinds[input.kind];
  const extension = (kind.types as Record<string, string>)[input.contentType];

  if (!extension) {
    throw new HttpError(400, 'Formato no admitido. Usá fotos JPG, PNG o WebP y videos MP4, MOV o WebM.');
  }

  if (input.size > kind.maxBytes) {
    throw new HttpError(400, `El archivo supera el máximo de ${kind.maxBytes / MB} MB.`);
  }

  const path = `${kind.folder}/${randomUUID()}.${extension}`;
  const { data, error } = await requireSupabase().storage.from(BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    throw new HttpError(502, 'No se pudo preparar la subida. Revisá que exista el bucket "gallery".', error);
  }

  return { path: data.path, signedUrl: data.signedUrl };
}

async function assertUploaded(path: string) {
  const { data, error } = await requireSupabase().storage.from(BUCKET).exists(path);

  if (error || !data) {
    throw new HttpError(400, 'No encontramos el archivo subido. Volvé a intentarlo.', error);
  }
}

export async function createGalleryItem(rawInput: unknown) {
  const input = createGalleryItemSchema.parse(rawInput);
  const client = requireSupabase();

  const expectedFolder = input.mediaType === 'photo' ? 'photos/' : 'videos/';

  if (!input.storagePath.startsWith(expectedFolder)) {
    throw new HttpError(400, 'El tipo de archivo no coincide con la ruta.');
  }

  await assertUploaded(input.storagePath);
  if (input.posterPath) {
    await assertUploaded(input.posterPath);
  }

  const { data: last, error: lastError } = await client
    .from('gallery_items')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  if (lastError) {
    throw isMissingSchemaError(lastError) ? missingGalleryError(lastError) : new HttpError(502, 'No se pudo guardar el archivo.', lastError);
  }

  const { data, error } = await client
    .from('gallery_items')
    .insert({
      media_type: input.mediaType,
      storage_path: input.storagePath,
      poster_path: input.posterPath ?? null,
      alt: input.alt,
      sort_order: (last?.sort_order ?? -1) + 1
    })
    .select(gallerySelect)
    .single<GalleryRow>();

  if (error || !data) {
    throw new HttpError(502, 'No se pudo guardar el archivo en la galería.', error);
  }

  return toGalleryItem(data);
}

export async function updateGalleryItem(id: string, rawInput: unknown) {
  const safeId = z.string().uuid().parse(id);
  const input = updateGalleryItemSchema.parse(rawInput);
  const patch = {
    ...(input.alt !== undefined ? { alt: input.alt } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {})
  };

  const { data, error } = await requireSupabase()
    .from('gallery_items')
    .update(patch)
    .eq('id', safeId)
    .select(gallerySelect)
    .single<GalleryRow>();

  if (error || !data) {
    throw new HttpError(502, 'No se pudo actualizar el archivo.', error);
  }

  return toGalleryItem(data);
}

export async function reorderGallery(rawInput: unknown) {
  const { ids } = reorderGallerySchema.parse(rawInput);
  const client = requireSupabase();

  const results = await Promise.all(ids.map((id, index) => (
    client.from('gallery_items').update({ sort_order: index }).eq('id', id)
  )));
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    throw new HttpError(502, 'No se pudo guardar el orden.', failed.error);
  }

  return listAdminGallery();
}

export async function deleteGalleryItem(id: string) {
  const safeId = z.string().uuid().parse(id);
  const client = requireSupabase();

  const { data, error } = await client
    .from('gallery_items')
    .delete()
    .eq('id', safeId)
    .select('storage_path, poster_path')
    .maybeSingle<{ storage_path: string; poster_path: string | null }>();

  if (error) {
    throw new HttpError(502, 'No se pudo eliminar el archivo.', error);
  }

  if (!data) {
    throw new HttpError(404, 'El archivo ya no existe.');
  }

  // Si falla el borrado en Storage el item igual desaparece de la web; solo queda el archivo huerfano.
  const paths = [data.storage_path, data.poster_path].filter((path): path is string => Boolean(path));
  const { error: storageError } = await client.storage.from(BUCKET).remove(paths);

  if (storageError) {
    console.warn('No se pudieron borrar archivos de la galería en Storage.', storageError);
  }

  return { id: safeId, deleted: true };
}
