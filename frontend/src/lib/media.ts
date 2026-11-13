import type { GalleryMediaType } from '../types';

const MB = 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * MB;
const MAX_PHOTO_SIDE = 1600;
const POSTER_WIDTH = 720;

const videoTypesByExtension: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm'
};

export type PreparedUpload = {
  mediaType: GalleryMediaType;
  file: Blob;
  poster: Blob | null;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

// WebP si el navegador lo soporta; si no, JPEG.
async function encodeImage(canvas: HTMLCanvasElement) {
  const webp = await canvasToBlob(canvas, 'image/webp', 0.82);

  if (webp && webp.type === 'image/webp') {
    return webp;
  }

  const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.85);

  if (!jpeg) {
    throw new Error('No pudimos procesar la imagen.');
  }

  return jpeg;
}

function drawScaled(source: CanvasImageSource, width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Las fotos de celular pesan varios MB: se achican a 1600 px y se pasan a WebP antes de subir.
async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    return await encodeImage(drawScaled(bitmap, bitmap.width, bitmap.height, MAX_PHOTO_SIDE));
  } finally {
    bitmap.close();
  }
}

// Toma un fotograma cerca del segundo 1 para usarlo de portada. Si el navegador
// no puede leer el video, se sube igual sin portada.
function extractVideoPoster(file: Blob) {
  return new Promise<Blob | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const timeout = window.setTimeout(() => finish(null), 15000);

    function finish(result: Blob | null) {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      resolve(result);
    }

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };
    video.onseeked = () => {
      encodeImage(drawScaled(video, video.videoWidth, video.videoHeight, POSTER_WIDTH))
        .then(finish)
        .catch(() => finish(null));
    };
    video.src = url;
  });
}

function videoContentType(file: File) {
  if (file.type.startsWith('video/')) {
    return file.type;
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return videoTypesByExtension[extension] ?? '';
}

export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (file.type.startsWith('image/')) {
    return { mediaType: 'photo', file: await compressImage(file), poster: null };
  }

  const contentType = videoContentType(file);

  if (!contentType) {
    throw new Error(`"${file.name}" no es una foto ni un video compatible.`);
  }

  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`"${file.name}" pesa ${(file.size / MB).toFixed(0)} MB. El máximo para videos es 50 MB.`);
  }

  const video = file.type === contentType ? file : new Blob([file], { type: contentType });
  return { mediaType: 'video', file: video, poster: await extractVideoPoster(video) };
}
