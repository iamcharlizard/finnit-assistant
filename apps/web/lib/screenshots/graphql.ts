import type { ReceiptStatus } from '@/lib/receipts/graphql';

export type ScreenshotLineStatus =
  | 'pending'
  | 'matched'
  | 'created'
  | 'ignored';
export type ScreenshotReviewField = 'date' | 'merchant' | 'amount';

export interface ScreenshotLine {
  id: string;
  /** ISO date-only. */
  date: string;
  merchant: string | null;
  /** 0 when it couldn't be read. */
  amount: number;
  direction: 'in' | 'out';
  inProcess: boolean;
  review: ScreenshotReviewField[];
  /** pending: will be saved; matched: already registered; ignored: left out. */
  status: ScreenshotLineStatus;
  categoryId: string | null;
  matchedTransaction: {
    id: string;
    date: string;
    amount: number;
    name: string | null;
  } | null;
}

export interface ScreenshotImport {
  id: string;
  status: ReceiptStatus;
  accountHint: string | null;
  last4: string | null;
  account: { id: string; name: string; currency: string } | null;
  lines: ScreenshotLine[];
  movementsRead: number;
  errorMessage: string | null;
}

const FIELDS =
  'id status accountHint last4 movementsRead errorMessage account { id name currency } lines { id date merchant amount direction inProcess review status categoryId matchedTransaction { id date amount name } }';

export const SCREENSHOT_IMPORT_QUERY = `query ScreenshotImport($id: ID!) { screenshotImport(id: $id) { ${FIELDS} } }`;
export const SET_SCREENSHOT_ACCOUNT_MUTATION = `mutation SetScreenshotAccount($id: ID!, $accountId: String!) { setScreenshotAccount(id: $id, accountId: $accountId) { ${FIELDS} } }`;
export const UPDATE_SCREENSHOT_LINE_MUTATION = `mutation UpdateScreenshotLine($lineId: ID!, $input: UpdateScreenshotLineInput!) { updateScreenshotLine(lineId: $lineId, input: $input) { ${FIELDS} } }`;
export const CONFIRM_SCREENSHOT_MUTATION = `mutation ConfirmScreenshot($id: ID!) { confirmScreenshotImport(id: $id) { ${FIELDS} } }`;
export const DISCARD_SCREENSHOT_MUTATION = `mutation DiscardScreenshot($id: ID!) { discardScreenshotImport(id: $id) }`;

/** What the review can change in a line (UpdateScreenshotLineInput). */
export interface ScreenshotLineChange {
  date?: string;
  merchant?: string;
  amount?: number;
  direction?: 'in' | 'out';
  inProcess?: boolean;
  categoryId?: string | null;
  include?: boolean;
}
