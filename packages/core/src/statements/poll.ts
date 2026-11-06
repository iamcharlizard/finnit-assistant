import type { StatementStatus } from './types';
import { isWorking } from './view';

/** The review page asks for the statement this often while it's extracted… */
export const POLL_INTERVAL_MS = 2_000;
/** …and gives up after this long (the user can reload to keep waiting). */
export const POLL_MAX_MS = 3 * 60_000;

export type PollDecision = 'continue' | 'done' | 'timeout';

export function pollDecision(
  status: StatementStatus,
  elapsedMs: number,
): PollDecision {
  if (!isWorking(status)) return 'done';
  return elapsedMs >= POLL_MAX_MS ? 'timeout' : 'continue';
}
