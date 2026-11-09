import { redirect } from 'next/navigation';

/**
 * "Clasificar movimientos" lives in the history now ("Por clasificar"):
 * old links (bookmarks, notifications) land there, across every month like
 * the old default of the notification.
 */
export default async function CategorizePage({
  searchParams,
}: PageProps<'/transactions/categorize'>) {
  const params = await searchParams;
  const query = new URLSearchParams({ review: '1' });
  const account = typeof params.account === 'string' ? params.account : null;
  if (account) query.set('account', account);
  const month = typeof params.month === 'string' ? params.month : null;
  if (month) query.set('month', month);
  redirect(`/history?${query.toString()}`);
}
