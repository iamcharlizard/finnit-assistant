import type { UserAvatar } from '@/lib/api/finnit-api';

/** Where the browser loads an uploaded photo from (the same-origin file proxy). */
export const AVATAR_PATH = '/api/files/me/avatar';

/**
 * The image to show for a user's avatar: their uploaded photo (versioned,
 * so a new one is not served from cache), their Google picture, or null
 * for initials.
 */
export function avatarSrc(
  avatar: UserAvatar | null | undefined,
): string | null {
  if (!avatar) return null;
  if (avatar.source === 'uploaded') {
    return `${AVATAR_PATH}?v=${encodeURIComponent(avatar.version)}`;
  }
  return avatar.url;
}
