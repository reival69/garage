// Talleo — client-side image compression. Photos are stored as small base64
// JPEGs inside localStorage, so we downscale and re-encode aggressively to
// avoid blowing the storage quota. Browser-only (uses canvas/DOM).

const MAX_DIMENSION = 720;
const QUALITY = 0.55;

export const MAX_PHOTO_BYTES = 220_000; // ~220 KB encoded ceiling per photo.

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    img.src = src;
  });
}

/**
 * Downscale to MAX_DIMENSION on the longest side and re-encode as JPEG.
 * Returns a small base64 data URL suitable for localStorage.
 */
export async function compressImage(file: File): Promise<string> {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  if (width >= height && width > MAX_DIMENSION) {
    height = Math.round((height * MAX_DIMENSION) / width);
    width = MAX_DIMENSION;
  } else if (height > MAX_DIMENSION) {
    width = Math.round((width * MAX_DIMENSION) / height);
    height = MAX_DIMENSION;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", QUALITY);
}
