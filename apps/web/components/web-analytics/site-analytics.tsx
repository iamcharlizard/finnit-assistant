'use client';

import { Analytics } from '@vercel/analytics/next';

import { redactAnalyticsEvent } from '@/lib/web-analytics/before-send';

/**
 * Vercel Web Analytics (visitors, page views, referrers, countries,
 * devices). Only collects on Vercel deployments with Analytics enabled; in
 * development it logs the events to the console instead.
 */
export function SiteAnalytics() {
  return <Analytics beforeSend={redactAnalyticsEvent} />;
}
