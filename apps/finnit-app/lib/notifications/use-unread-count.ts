import { useQuery } from 'urql';

const UNREAD_QUERY = `query UnreadNotifications {
  scheduled: notifications(status: scheduled, first: 1) { totalCount }
  sent: notifications(status: sent, first: 1) { totalCount }
}`;

/** Notifications not read yet, for the bell's badge (any failure counts as zero). */
export function useUnreadCount(): number {
  const [{ data }] = useQuery<{ scheduled: { totalCount: number }; sent: { totalCount: number } }>({
    query: UNREAD_QUERY,
  });
  return data ? data.scheduled.totalCount + data.sent.totalCount : 0;
}
