import { AliasMatchType } from '@finnit/database';

import type { JsonSchema } from '../ai/providers/ai-provider';
import { aliasPatternFor } from '../transfers/transfer-detection';
import { MAX_ALIAS_PATTERN_LENGTH } from './dto/merchant-alias.dto';

/**
 * Suggesting the pattern of an automatic name (a merchant alias rule) from
 * a few example bank texts: the AI prompt and schema, a check of what it
 * returns, and a no-AI fallback built from the words the examples share.
 * Whether a pattern really covers the examples is checked in Postgres by
 * the service (the same SQL the rules match with).
 */

export const MAX_PATTERN_EXAMPLES = 10;

export interface PatternCandidate {
  matchType: AliasMatchType;
  pattern: string;
  explanation: string;
}

export const ALIAS_PATTERN_PROMPT = `You write the matching rule of a personal finance app's "automatic name".
You get bank movement texts (examples) that the user wants to show under one name, and optionally texts that must NOT match.
Bank texts carry reference numbers, folios, dates, RFCs and amounts that change every time: ignore those parts.

Return the simplest rule that matches EVERY example and none of the excluded texts:
- matchType "contains": a fixed fragment all examples share (preferred whenever it is enough).
- matchType "starts_with": a fixed beginning all examples share.
- matchType "regex": only when no fixed fragment works. PostgreSQL POSIX syntax, case-insensitive; no lookahead/lookbehind, no backreferences, no flags. Keep it short.
Matching ignores case and accents and collapses spaces (except regex, which only ignores case and accents).
The pattern must be specific enough not to catch unrelated movements (avoid generic words like "PAGO", "COMPRA", "SPEI" alone).
explanation: one short sentence for the user, in the language given by "locale", saying what the rule looks for.`;

export const ALIAS_PATTERN_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    matchType: { type: 'string', enum: ['contains', 'starts_with', 'regex'] },
    pattern: { type: 'string' },
    explanation: { type: 'string' },
  },
  required: ['matchType', 'pattern', 'explanation'],
};

const AI_MATCH_TYPES: ReadonlyArray<AliasMatchType> = [
  AliasMatchType.contains,
  AliasMatchType.starts_with,
  AliasMatchType.regex,
];

/** Lookarounds and backreferences: not supported (or risky) in Postgres ARE. */
const UNSAFE_REGEX = /\(\?[=!<]|\\[1-9]/;

/** What the AI returned, if it is a usable rule. */
export function parseAiPattern(data: unknown): PatternCandidate | null {
  if (!data || typeof data !== 'object') return null;
  const { matchType, pattern, explanation } = data as Record<string, unknown>;
  if (
    typeof matchType !== 'string' ||
    !AI_MATCH_TYPES.includes(matchType as AliasMatchType)
  ) {
    return null;
  }
  const text = typeof pattern === 'string' ? pattern.trim() : '';
  if (!text || text.length > MAX_ALIAS_PATTERN_LENGTH) return null;
  if (matchType === AliasMatchType.regex && UNSAFE_REGEX.test(text)) {
    return null;
  }
  // A one- or two-letter fragment would catch almost anything.
  if (
    matchType !== AliasMatchType.regex &&
    text.replace(/\W/g, '').length < 3
  ) {
    return null;
  }
  return {
    matchType: matchType as AliasMatchType,
    pattern: text,
    explanation:
      typeof explanation === 'string' ? explanation.trim().slice(0, 300) : '',
  };
}

const normalize = (word: string) =>
  word
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Fallback patterns, best first (all "contains"): the longest run of
 * digit-free words of the first example that every example has, then each
 * example's own run (aliasPatternFor). "KSK*VID ONLYFANSFPA 231020BF8MX" and
 * "KSK*VID ONLYFANSFPA 241105AA1MX" → "KSK*VID ONLYFANSFPA".
 */
export function heuristicPatterns(examples: ReadonlyArray<string>): string[] {
  const candidates: string[] = [];
  const [first, ...rest] = examples;
  if (first) {
    const others = rest.map((text) =>
      normalize(text).replace(/\s+/g, ' ').trim(),
    );
    const words = first.trim().split(/\s+/);
    let best: string[] = [];
    for (let start = 0; start < words.length; start++) {
      for (let end = start + 1; end <= words.length; end++) {
        const run = words.slice(start, end);
        if (run.some((word) => /\d/.test(word))) break;
        const phrase = normalize(run.join(' '));
        if (!others.every((text) => text.includes(phrase))) break;
        if (run.join(' ').length > best.join(' ').length) best = run;
      }
    }
    const common = best.join(' ').slice(0, MAX_ALIAS_PATTERN_LENGTH);
    if (common.replace(/\W/g, '').length >= 3) candidates.push(common);
  }
  for (const text of examples) {
    const own = aliasPatternFor(text);
    if (own.replace(/\W/g, '').length >= 3) candidates.push(own);
  }
  return [...new Set(candidates)];
}

/** The text the AI gets: examples, exclusions and the user's language. */
export function aliasPatternRequest(
  examples: ReadonlyArray<string>,
  exclude: ReadonlyArray<string>,
  locale: string,
  previous?: {
    candidate: PatternCandidate;
    missed: string[];
    caught: string[];
  },
): string {
  return JSON.stringify({
    locale,
    examples,
    exclude,
    ...(previous && {
      previousAttempt: {
        matchType: previous.candidate.matchType,
        pattern: previous.candidate.pattern,
        didNotMatch: previous.missed,
        wronglyMatched: previous.caught,
        note: 'Fix the rule so it matches every example and none of the excluded texts.',
      },
    }),
  });
}
