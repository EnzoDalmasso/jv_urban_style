import trabajo1 from '../assets/gallery/trabajo-1.webp';
import trabajo2 from '../assets/gallery/trabajo-2.webp';
import trabajo3 from '../assets/gallery/trabajo-3.webp';
import trabajo4 from '../assets/gallery/trabajo-4.webp';
import video1 from '../assets/gallery/video-1.mp4';
import video1Poster from '../assets/gallery/video-1-poster.webp';
import video2 from '../assets/gallery/video-2.mp4';
import video2Poster from '../assets/gallery/video-2-poster.webp';
import video3 from '../assets/gallery/video-3.mp4';
import video3Poster from '../assets/gallery/video-3-poster.webp';
import type { GalleryEntry, GalleryMediaType } from '../types';

export type GalleryItem = {
  type: GalleryMediaType;
  src: string;
  poster: string | null;
  alt: string;
};

// Galeria incluida en el build. Se muestra mientras Supabase no tenga la galeria
// configurada, y el panel admin la puede importar a Supabase con un boton.
export const bundledGallery: GalleryItem[] = [
  { type: 'video', src: video1, poster: video1Poster, alt: 'Video de un corte con fade y flequillo texturizado' },
  { type: 'photo', src: trabajo1, poster: null, alt: 'Corte con fade bajo y flequillo texturizado' },
  { type: 'photo', src: trabajo3, poster: null, alt: 'Corte con decoloración platinada y fade' },
  { type: 'video', src: video3, poster: video3Poster, alt: 'Video de un corte con rulos y fade' },
  { type: 'photo', src: trabajo2, poster: null, alt: 'Corte con fade y flequillo, vista lateral' },
  { type: 'photo', src: trabajo4, poster: null, alt: 'Corte con fade alto y flequillo recto' },
  { type: 'video', src: video2, poster: video2Poster, alt: 'Video de un corte visto desde la nuca' }
];

export function fromGalleryEntries(entries: GalleryEntry[]): GalleryItem[] {
  return entries.map((entry) => ({
    type: entry.mediaType,
    src: entry.url,
    poster: entry.posterUrl,
    alt: entry.alt || (entry.mediaType === 'video' ? 'Video de un trabajo de la barbería' : 'Trabajo de la barbería')
  }));
}
