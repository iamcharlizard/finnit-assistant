import { upperAscii } from '../recurring-expenses/suggestions/detect';

/**
 * Bank wordings of a transfer (Mexican banks): SPEI, "traspaso",
 * "transferencia (interbancaria)", Banamex's "P INT" / "P TER" (to another
 * bank / to a third party), TEF. Matched on the uppercase text without
 * accents.
 */
const TRANSFER_WORDINGS: readonly RegExp[] = [
  /\bSPEI\b/,
  /\bTRANSF(ERENCIA|ER|\.)?\b/,
  /\bTRASPASO\b/,
  /\bINTERBANCARI[AO]\b/,
  /^P (INT|TER)\b/,
  /\bTEF\b/,
  /\bENVIO DE DINERO\b/,
];

/** Whether a movement's text reads like money sent between accounts. */
export function looksLikeTransfer(
  ...texts: (string | null | undefined)[]
): boolean {
  return texts.some((text) => {
    if (!text) return false;
    const value = upperAscii(text).replace(/\s+/g, ' ').trim();
    return TRANSFER_WORDINGS.some((wording) => wording.test(value));
  });
}

/**
 * The part of a movement's text that repeats from one transfer to the next,
 * to remember it by: the longest run of words without digits (reference
 * numbers and dates change every time). "P INT 0311026 Transferencia
 * interbancaria" → "Transferencia interbancaria".
 */
export function aliasPatternFor(text: string | null | undefined): string {
  const runs: string[][] = [[]];
  for (const word of (text ?? '').trim().split(/\s+/)) {
    if (!word) continue;
    if (/\d/.test(word)) runs.push([]);
    else runs[runs.length - 1].push(word);
  }
  const longest = runs.reduce(
    (best, run) => (run.join(' ').length > best.join(' ').length ? run : best),
    [] as string[],
  );
  return longest.join(' ').slice(0, 200);
}
