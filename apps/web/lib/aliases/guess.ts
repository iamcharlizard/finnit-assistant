/**
 * A first guess of what an automatic name should look for in a bank text:
 * the longest run of words without digits (folios, dates and references
 * change from one movement to the next). "KSK*VID ONLYFANSFPA 231020BF8MX"
 * → "KSK*VID ONLYFANSFPA". The AI can refine it.
 */
export function aliasPatternGuess(text: string | null | undefined): string {
  const runs: string[][] = [[]];
  for (const word of (text ?? '').trim().split(/\s+/)) {
    if (!word) continue;
    if (/\d/.test(word)) runs.push([]);
    else runs[runs.length - 1]!.push(word);
  }
  const longest = runs.reduce(
    (best, run) => (run.join(' ').length > best.join(' ').length ? run : best),
    [] as string[],
  );
  return (longest.join(' ') || (text ?? '').trim()).slice(0, 200);
}
