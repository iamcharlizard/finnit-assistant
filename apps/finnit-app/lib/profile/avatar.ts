import { API_ORIGIN } from '@/lib/api/config';
import type { AuthUser } from '@/contexts/AuthContext';
import { readItem } from '@/lib/session/storage';

/**
 * The image for a user's avatar: their uploaded photo (from the API, with
 * the session token; versioned so a new one isn't cached), their Google
 * picture, or null for initials.
 */
export function avatarSource(
  avatar: AuthUser['avatar'],
): { uri: string; headers?: Record<string, string> } | null {
  if (!avatar) return null;
  if (avatar.source === 'uploaded') {
    const token = readItem('accessToken');
    return {
      uri: `${API_ORIGIN}/me/avatar?v=${encodeURIComponent(avatar.version ?? '')}`,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    };
  }
  return avatar.url ? { uri: avatar.url } : null;
}
