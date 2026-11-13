import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Eye, EyeOff, Images, Loader2, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import {
  createAdminGalleryItem,
  deleteAdminGalleryItem,
  fetchAdminGallery,
  reorderAdminGallery,
  requestGalleryUploadUrl,
  updateAdminGalleryItem,
  uploadToSignedUrl
} from '../../lib/api';
import { bundledGallery } from '../../lib/gallery';
import { type PreparedUpload, prepareUpload } from '../../lib/media';
import type { GalleryEntry } from '../../types';

type GalleryManagerProps = {
  pin: string;
};

async function uploadPrepared(pin: string, prepared: PreparedUpload, alt: string) {
  const media = await requestGalleryUploadUrl(pin, {
    kind: prepared.mediaType,
    contentType: prepared.file.type,
    size: prepared.file.size
  });
  await uploadToSignedUrl(media.signedUrl, prepared.file);

  let posterPath: string | null = null;

  if (prepared.poster) {
    const poster = await requestGalleryUploadUrl(pin, {
      kind: 'poster',
      contentType: prepared.poster.type,
      size: prepared.poster.size
    });
    await uploadToSignedUrl(poster.signedUrl, prepared.poster);
    posterPath = poster.path;
  }

  const { item } = await createAdminGalleryItem(pin, {
    mediaType: prepared.mediaType,
    storagePath: media.path,
    posterPath,
    alt
  });
  return item;
}

async function fetchBlob(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('No pudimos leer un archivo de la galería actual.');
  }

  return response.blob();
}

export function GalleryManager({ pin }: GalleryManagerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GalleryEntry[] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [alt, setAlt] = useState('');
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const uploading = progress !== null;

  useEffect(() => {
    if (!open || items !== null) {
      return;
    }

    fetchAdminGallery(pin)
      .then((response) => setItems(response.items))
      .catch((err: Error) => setError(err.message));
  }, [open, items, pin]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
    setNotice(null);
    setError(null);
  }

  async function runUploads(jobs: Array<{ label: string; prepare: () => Promise<PreparedUpload>; alt: string }>) {
    setError(null);
    setNotice(null);
    let uploaded = 0;

    try {
      for (const [index, job] of jobs.entries()) {
        setProgress(`Subiendo ${index + 1} de ${jobs.length}: ${job.label}`);
        const item = await uploadPrepared(pin, await job.prepare(), job.alt);
        setItems((current) => [...(current ?? []), item]);
        uploaded += 1;
      }

      setNotice(uploaded === 1 ? 'Se subió 1 archivo.' : `Se subieron ${uploaded} archivos.`);
      return true;
    } catch (err) {
      const prefix = uploaded > 0 ? `Se subieron ${uploaded} de ${jobs.length}. ` : '';
      setError(prefix + (err instanceof Error ? err.message : 'No se pudo subir el archivo.'));
      return false;
    } finally {
      setProgress(null);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (files.length === 0) {
      setError('Elegí al menos una foto o un video.');
      return;
    }

    const ok = await runUploads(files.map((file) => ({
      label: file.name,
      prepare: () => prepareUpload(file),
      alt: alt.trim()
    })));

    if (ok) {
      form.reset();
      setFiles([]);
      setAlt('');
    }
  }

  async function importBundledGallery() {
    await runUploads(bundledGallery.map((item, index) => ({
      label: `${item.type === 'video' ? 'video' : 'foto'} ${index + 1}`,
      alt: item.alt,
      prepare: async () => ({
        mediaType: item.type,
        file: await fetchBlob(item.src),
        poster: item.poster ? await fetchBlob(item.poster) : null
      })
    })));
  }

  async function runItemAction(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    setNotice(null);

    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setBusyId(null);
    }
  }

  function replaceItem(updated: GalleryEntry) {
    setItems((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? current);
  }

  function saveAlt(item: GalleryEntry) {
    const draft = altDrafts[item.id];

    if (draft === undefined || draft.trim() === item.alt) {
      return;
    }

    void runItemAction(item.id, async () => {
      const { item: updated } = await updateAdminGalleryItem(pin, item.id, { alt: draft.trim() });
      replaceItem(updated);
      setAltDrafts(({ [item.id]: _saved, ...rest }) => rest);
    });
  }

  function toggleVisible(item: GalleryEntry) {
    void runItemAction(item.id, async () => {
      const { item: updated } = await updateAdminGalleryItem(pin, item.id, { isActive: !item.isActive });
      replaceItem(updated);
    });
  }

  function move(item: GalleryEntry, delta: -1 | 1) {
    if (!items) {
      return;
    }

    const from = items.findIndex((current) => current.id === item.id);
    const to = from + delta;

    if (to < 0 || to >= items.length) {
      return;
    }

    const reordered = [...items];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    setItems(reordered);

    void runItemAction(item.id, async () => {
      const { items: saved } = await reorderAdminGallery(pin, reordered.map((current) => current.id));
      setItems(saved);
    });
  }

  function remove(item: GalleryEntry) {
    const kind = item.mediaType === 'video' ? 'este video' : 'esta foto';

    if (!window.confirm(`¿Eliminar ${kind} de la galería? No se puede deshacer.`)) {
      return;
    }

    void runItemAction(item.id, async () => {
      await deleteAdminGalleryItem(pin, item.id);
      setItems((current) => current?.filter((currentItem) => currentItem.id !== item.id) ?? current);
      setNotice('Archivo eliminado.');
    });
  }

  return (
    <section className="admin-panel wide gallery-manager">
      <div className="panel-heading collapsible-heading">
        <button className="panel-toggle-button" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
          <div>
            <p className="eyebrow">Web</p>
            <h2>Galería de trabajos</h2>
          </div>
          {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </button>
        <Images aria-hidden="true" />
      </div>

      {open && (
        <div className="gallery-manager-body">
          <form className="gallery-upload" onSubmit={handleUpload}>
            <label className="gallery-dropzone">
              <Upload aria-hidden="true" />
              <strong>{files.length > 0 ? `${files.length} archivo${files.length === 1 ? '' : 's'} elegido${files.length === 1 ? '' : 's'}` : 'Elegí fotos o videos'}</strong>
              <small>Las fotos se optimizan solas. Videos MP4 o MOV de hasta 50 MB.</small>
              <input
                type="file"
                accept="image/*,video/mp4,video/quicktime,video/webm"
                multiple
                onChange={handleFiles}
                disabled={uploading}
              />
            </label>
            <div className="gallery-upload-fields">
              <label>
                Descripción (opcional)
                <input
                  value={alt}
                  onChange={(event) => setAlt(event.target.value)}
                  maxLength={160}
                  placeholder="Ej: Fade bajo con flequillo"
                  disabled={uploading}
                />
              </label>
              <button className="primary-cta" type="submit" disabled={uploading || files.length === 0}>
                {uploading ? <Loader2 className="gallery-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                {uploading ? 'Subiendo…' : 'Subir a la galería'}
              </button>
            </div>
          </form>

          {progress && <p className="muted" role="status">{progress}</p>}
          {notice && <p className="success-text" role="status">{notice}</p>}
          {error && <p className="error-text" role="alert">{error}</p>}

          {items === null && !error && <p className="muted">Cargando galería…</p>}

          {items !== null && items.length === 0 && (
            <div className="gallery-empty">
              <p className="muted">
                Todavía no hay fotos ni videos cargados. La web está mostrando la galería que vino con el sitio.
              </p>
              <button className="secondary-button" type="button" onClick={importBundledGallery} disabled={uploading}>
                Importar esos {bundledGallery.length} archivos para poder editarlos
              </button>
            </div>
          )}

          {items !== null && items.length > 0 && (
            <ul className="gallery-admin-grid">
              {items.map((item, index) => {
                const busy = busyId === item.id;

                return (
                  <li className={item.isActive ? 'gallery-admin-card' : 'gallery-admin-card is-hidden'} key={item.id}>
                    <div className="gallery-admin-thumb">
                      {item.mediaType === 'photo' ? (
                        <img src={item.url} alt="" loading="lazy" />
                      ) : (
                        <video
                          src={item.posterUrl ? item.url : `${item.url}#t=0.1`}
                          poster={item.posterUrl ?? undefined}
                          preload={item.posterUrl ? 'none' : 'metadata'}
                          muted
                          playsInline
                        />
                      )}
                      <span className="gallery-admin-tag">
                        {item.mediaType === 'video' ? 'Video' : 'Foto'}
                        {!item.isActive && ' · Oculto'}
                      </span>
                    </div>

                    <label className="gallery-admin-alt">
                      Descripción
                      <input
                        value={altDrafts[item.id] ?? item.alt}
                        onChange={(event) => setAltDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                        onBlur={() => saveAlt(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                        }}
                        maxLength={160}
                        disabled={busy}
                      />
                    </label>

                    <div className="gallery-admin-actions">
                      <button className="icon-button" type="button" onClick={() => move(item, -1)} disabled={busy || index === 0} aria-label="Mover antes" title="Mover antes">
                        <ArrowLeft aria-hidden="true" />
                      </button>
                      <button className="icon-button" type="button" onClick={() => move(item, 1)} disabled={busy || index === items.length - 1} aria-label="Mover después" title="Mover después">
                        <ArrowRight aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => toggleVisible(item)}
                        disabled={busy}
                        aria-label={item.isActive ? 'Ocultar de la web' : 'Mostrar en la web'}
                        title={item.isActive ? 'Ocultar de la web' : 'Mostrar en la web'}
                      >
                        {item.isActive ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                      </button>
                      <button className="icon-button danger" type="button" onClick={() => remove(item)} disabled={busy} aria-label="Eliminar" title="Eliminar">
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
