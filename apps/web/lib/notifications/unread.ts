import 'server-only';

import { cookies } from 'next/headers';

import { apiGraphql } from '@/lib/api/finnit-api';
import { ACCESS_COOKIE } from '@/lib/auth/cookies';

/**
 * Notifications not read yet (scheduled or sent), for the top bar's badge.
 * The badge is secondary: any failure counts as zero.
 */
export async function unreadNotificationCount(): Promise<number> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return 0;
  const result = await apiGraphql<{
    scheduled: { totalCount: number };
    sent: { totalCount: number };
  }>(
    `query UnreadNotifications {
      scheduled: notifications(status: scheduled, first: 1) { totalCount }
      sent: notifications(status: sent, first: 1) { totalCount }
    }`,
    {},
    token,
  ).catch(() => null);
  if (!result?.data) return 0;
  return result.data.scheduled.totalCount + result.data.sent.totalCount;
}
