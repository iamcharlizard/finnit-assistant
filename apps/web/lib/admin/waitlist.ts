import { dayKeyOf, timeOf } from '@finnit/core/finance/dates';

/** /admin/waitlist: the newest 200 sign-ups (the API's page cap). */
export const WAITLIST_QUERY = `query AdminWaitlist {
  waitlistEntries(first: 200) {
    totalCount
    edges { node { id email locale source createdAt } }
  }
}`;

export interface WaitlistEntryNode {
  id: string;
  email: string;
  locale: string | null;
  source: string | null;
  createdAt: string;
}

export interface WaitlistData {
  waitlistEntries: {
    totalCount: number;
    edges: { node: WaitlistEntryNode }[];
  };
}

export interface WaitlistRow {
  id: string;
  email: string;
  locale: string;
  source: string;
  /** Sortable "YYYY-MM-DD HH:mm" in Mexico City. */
  joinedAt: string;
}

/** Plain rows for the table; dates deterministic (no Intl output). */
export function waitlistRows(data: WaitlistData): WaitlistRow[] {
  return data.waitlistEntries.edges.map(({ node }) => ({
    id: node.id,
    email: node.email,
    locale: node.locale ?? '—',
    source: node.source ?? '—',
    joinedAt:
      `${dayKeyOf(node.createdAt)} ${timeOf(node.createdAt) ?? ''}`.trim(),
  }));
}
