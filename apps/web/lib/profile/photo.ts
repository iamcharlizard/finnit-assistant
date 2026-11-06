import { AVATAR_PATH } from './avatar';

/** Side of the stored photo, in pixels (shown at most at 96 px, 2× for retina). */
export const AVATAR_SIZE = 256;
/** What the API accepts. */
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Before cropping: a phone photo is fine, anything bigger is not a photo. */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export class AvatarUploadError extends Error {
  constructor(readonly status: number) {
    super(`Profile photo upload failed (${status})`);
    this.name = 'AvatarUploadError';
  }
}

/** The centered square of an image (what a round avatar shows). */
export function centerSquare(
  width: number,
  height: number,
): { x: number; y: number; side: number } {
  const side = Math.min(width, height);
  return {
    x: Math.round((width - side) / 2),
    y: Math.round((height - side) / 2),
    side,
  };
}

/** Whether the picked file can be used as a profile photo. */
export function isAcceptedPhoto(file: { type: string; size: number }): boolean {
  return (
    (AVATAR_TYPES as readonly string[]).includes(file.type.toLowerCase()) &&
    file.size > 0 &&
    file.size <= MAX_PHOTO_BYTES
  );
}

/**
 * Crops the photo to its centered square and scales it to AVATAR_SIZE, as
 * WEBP (JPEG where the browser can't encode WEBP). A few KB, whatever the
 * phone took.
 */
export async function squarePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { x, y, side } = centerSquare(bitmap.width, bitmap.height);
    const size = Math.min(AVATAR_SIZE, side);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No canvas');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, x, y, side, side, 0, 0, size, size);
    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    const webp = await encode('image/webp');
    if (webp && webp.type === 'image/webp') return webp;
    const jpeg = await encode('image/jpeg');
    if (!jpeg) throw new Error('Could not encode the photo');
    return jpeg;
  } finally {
    bitmap.close();
  }
}

/** POST /api/files/me/avatar (multipart `file`). */
export async function uploadAvatar(photo: Blob): Promise<void> {
  const body = new FormData();
  const extension = photo.type === 'image/webp' ? 'webp' : 'jpg';
  body.append('file', photo, `avatar.${extension}`);
  const response = await fetch(AVATAR_PATH, { method: 'POST', body });
  if (response.status === 401) {
    window.location.assign(
      `/login?next=${encodeURIComponent(window.location.pathname)}`,
    );
  }
  if (!response.ok) throw new AvatarUploadError(response.status);
}
