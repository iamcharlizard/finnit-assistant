/**
 * "¿Qué podrías recortar?": the user answers a short questionnaire about
 * their life and the AI judges each recurring expense essential, reducible
 * (keep it, but cheaper) or dispensable, with a short reason. The user
 * never picks the level. Pure rules: questions, prompt and parsing.
 * Mirrors packages/core/src/recurring/essentials.ts (the questions).
 */
import { EssentialLevel } from '@finnit/database';
import type { JsonSchema } from '../../ai/providers/ai-provider';

/** Each question and its closed answers. */
export const ESSENTIAL_QUESTIONS = {
  household: ['alone', 'partner', 'family', 'shared'],
  dependents: ['none', 'children', 'parents', 'both'],
  work: ['office', 'hybrid', 'remote', 'self_employed', 'not_working'],
  transport: ['car', 'public', 'mixed', 'none'],
  health: ['none', 'occasional', 'ongoing'],
  entertainment: ['daily', 'weekly', 'rarely'],
  goal: ['save', 'debt', 'emergency', 'balanced'],
  cut: ['light', 'moderate', 'aggressive'],
} as const satisfies Record<string, readonly string[]>;

export type EssentialQuestion = keyof typeof ESSENTIAL_QUESTIONS;
export type EssentialAnswers = Partial<Record<EssentialQuestion, string>>;

/** Only known questions with one of their answers; every question answered. */
export function validAnswers(
  input: ReadonlyArray<{ question: string; answer: string }>,
): EssentialAnswers | null {
  const answers: EssentialAnswers = {};
  for (const { question, answer } of input) {
    const options = (ESSENTIAL_QUESTIONS as Record<string, readonly string[]>)[
      question
    ];
    if (!options || !options.includes(answer)) return null;
    answers[question as EssentialQuestion] = answer;
  }
  const all = Object.keys(ESSENTIAL_QUESTIONS) as EssentialQuestion[];
  return all.every((q) => answers[q]) ? answers : null;
}

/** Answers read back from the stored JSON (unknown keys dropped). */
export function storedAnswers(value: unknown): EssentialAnswers {
  if (!value || typeof value !== 'object') return {};
  const answers: EssentialAnswers = {};
  for (const [question, answer] of Object.entries(value)) {
    const options = (ESSENTIAL_QUESTIONS as Record<string, readonly string[]>)[
      question
    ];
    if (options && typeof answer === 'string' && options.includes(answer)) {
      answers[question as EssentialQuestion] = answer;
    }
  }
  return answers;
}

export const ESSENTIALS_PROMPT = `You help a person in Mexico decide which of their recurring expenses they could cut.
You get their answers to a short questionnaire about their life and their recurring expenses (id, name, kind, category, monthly cost).
Judge each expense for THIS person:
- "essential": they need it to live or work given their answers (housing, basic utilities, health they need, transport they depend on, insurance protecting dependents).
- "reducible": they need what it gives, but a cheaper plan, provider or fewer of them would do (e.g. a large phone plan, several gyms, premium tiers).
- "dispensable": they could stop paying it without hurting their basic needs (extra streaming services they rarely use, memberships, apps).
Use their answers: someone who works remotely needs internet; someone without a car doesn't need car insurance; rarely using entertainment makes those subscriptions dispensable; a stronger wish to cut ("cut": "aggressive") leans to reducible/dispensable for anything not clearly needed.
reason: one short, kind sentence in the language given by "locale" (at most 140 characters), saying why, about this person. No amounts.
Return one item per expense id given, nothing else.`;

export const ESSENTIALS_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          level: {
            type: 'string',
            enum: ['essential', 'reducible', 'dispensable'],
          },
          reason: { type: 'string' },
        },
        required: ['id', 'level', 'reason'],
      },
    },
  },
  required: ['items'],
};

export interface ExpenseForEssentials {
  id: string;
  name: string;
  kind: string;
  category: string | null;
  monthlyCost: number;
  currency: string;
}

/** What the AI reads: the answers, the locale and the expenses. */
export function essentialsRequest(
  answers: EssentialAnswers,
  expenses: ReadonlyArray<ExpenseForEssentials>,
  locale: string,
): string {
  return JSON.stringify({
    locale,
    answers,
    expenses: expenses.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      category: e.category,
      monthlyCost: `${e.monthlyCost.toFixed(2)} ${e.currency}`,
    })),
  });
}

const LEVELS: ReadonlyArray<string> = Object.values(EssentialLevel);
export const MAX_REASON = 300;

/** The AI's levels for the given ids; anything else is dropped. */
export function parseEssentials(
  data: unknown,
  ids: ReadonlySet<string>,
): Map<string, { level: EssentialLevel; reason: string }> {
  const result = new Map<string, { level: EssentialLevel; reason: string }>();
  const items = (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return result;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const { id, level, reason } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !ids.has(id)) continue;
    if (typeof level !== 'string' || !LEVELS.includes(level)) continue;
    result.set(id, {
      level: level as EssentialLevel,
      reason:
        typeof reason === 'string' ? reason.trim().slice(0, MAX_REASON) : '',
    });
  }
  return result;
}
