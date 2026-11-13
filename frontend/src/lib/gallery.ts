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

export type GalleryItem =
  | { type: 'photo'; src: string; alt: string }
  | { type: 'video'; src: string; poster: string; alt: string };

// Fotos y videos de clientes del local. Para sumar uno: optimizarlo (webp / mp4 h264)
// en assets/gallery e importarlo aca.
export const galleryItems: GalleryItem[] = [
  { type: 'video', src: video1, poster: video1Poster, alt: 'Video de un corte con fade y flequillo texturizado' },
  { type: 'photo', src: trabajo1, alt: 'Corte con fade bajo y flequillo texturizado' },
  { type: 'photo', src: trabajo3, alt: 'Corte con decoloración platinada y fade' },
  { type: 'video', src: video3, poster: video3Poster, alt: 'Video de un corte con rulos y fade' },
  { type: 'photo', src: trabajo2, alt: 'Corte con fade y flequillo, vista lateral' },
  { type: 'photo', src: trabajo4, alt: 'Corte con fade alto y flequillo recto' },
  { type: 'video', src: video2, poster: video2Poster, alt: 'Video de un corte visto desde la nuca' }
];
