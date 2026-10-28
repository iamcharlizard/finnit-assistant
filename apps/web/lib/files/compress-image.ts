/**
 * Phone photos (3–5 MB) are shrunk in the browser before uploading: the web
 * runs on Vercel, whose functions reject request bodies over 4.5 MB, and the
 * OCR reads receipts at ~1600 px anyway. PDFs, HEIC (most browsers can't
 * decode it), GIFs and small images are sent as they are.
 */
export const COMPRESS_FROM_BYTES = 1.5 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 2000;
const JPEG_QUALITY = 0.85;

/** Whether `file` should go through the canvas before uploading. */
export function shouldCompress(file: { type: string; size: number }): boolean {
  const type = file.type.toLowerCase();
  return (
    file.size > COMPRESS_FROM_BYTES &&
    type.startsWith('image/') &&
    !/heic|heif|gif|svg/.test(type)
  );
}

/** Width and height scaled down to fit `maxSide`, keeping the aspect ratio. */
export function fitWithin(
  width: number,
  height: number,
  maxSide = MAX_IMAGE_SIDE,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** "IMG_1234.PNG" → "IMG_1234.jpg". */
export function jpegName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '');
  return `${base || 'photo'}.jpg`;
}

/**
 * A smaller JPEG of `file`, or `file` itself when it shouldn't or can't be
 * compressed (or compressing doesn't make it smaller). Never throws.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!shouldCompress(file) || typeof createImageBitmap !== 'function') {
    return file;
  }
  try {
    // Applies the EXIF orientation, so the photo isn't sideways.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], jpegName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
