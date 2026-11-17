/**
 * "¿Qué podrías recortar?": the questionnaire the AI classifies recurring
 * expenses with (essential, reducible or dispensable). The user answers;
 * the AI decides. Mirrors apps/api/src/modules/recurring-expenses/
 * essentials/recurring-essentials.ts. Shared by the web and the mobile app.
 */
import type { GqlRunner } from '../graphql/request';

export const ESSENTIAL_QUESTIONS = [
  { key: 'household', options: ['alone', 'partner', 'family', 'shared'] },
  { key: 'dependents', options: ['none', 'children', 'parents', 'both'] },
  {
    key: 'work',
    options: ['office', 'hybrid', 'remote', 'self_employed', 'not_working'],
  },
  { key: 'transport', options: ['car', 'public', 'mixed', 'none'] },
  { key: 'health', options: ['none', 'occasional', 'ongoing'] },
  { key: 'entertainment', options: ['daily', 'weekly', 'rarely'] },
  { key: 'goal', options: ['save', 'debt', 'emergency', 'balanced'] },
  { key: 'cut', options: ['light', 'moderate', 'aggressive'] },
] as const;

export type EssentialQuestionKey = (typeof ESSENTIAL_QUESTIONS)[number]['key'];
export type EssentialAnswers = Partial<Record<EssentialQuestionKey, string>>;

export const ESSENTIAL_PROFILE_QUERY = `query RecurringEssentialProfile { recurringEssentialProfile { answers { question answer } updatedAt } }`;

export const SAVE_ESSENTIAL_PROFILE_MUTATION = `mutation SaveRecurringEssentialProfile($answers: [EssentialAnswerInput!]!) { saveRecurringEssentialProfile(answers: $answers) { classified aiUnavailable } }`;

export const CLASSIFY_ESSENTIALS_MUTATION = `mutation ClassifyRecurringEssentials($onlyMissing: Boolean!) { classifyRecurringEssentials(onlyMissing: $onlyMissing) { classified aiUnavailable } }`;

export interface ApiEssentialProfile {
  answers: { question: string; answer: string }[];
  updatedAt: string;
}

export interface EssentialsRun {
  classified: number;
  aiUnavailable: boolean;
}

export function answersOf(
  profile: ApiEssentialProfile | null,
): EssentialAnswers {
  const answers: EssentialAnswers = {};
  for (const { question, answer } of profile?.answers ?? []) {
    const known = ESSENTIAL_QUESTIONS.find((q) => q.key === question);
    if (known && (known.options as readonly string[]).includes(answer)) {
      answers[known.key] = answer;
    }
  }
  return answers;
}

/** Every question answered. */
export function isComplete(answers: EssentialAnswers): boolean {
  return ESSENTIAL_QUESTIONS.every((q) => Boolean(answers[q.key]));
}

/** The first question still without an answer (or the last one). */
export function firstOpenStep(answers: EssentialAnswers): number {
  const open = ESSENTIAL_QUESTIONS.findIndex((q) => !answers[q.key]);
  return open === -1 ? ESSENTIAL_QUESTIONS.length - 1 : open;
}

export async function loadEssentialProfile(
  run: GqlRunner,
): Promise<ApiEssentialProfile | null> {
  const data = await run<{
    recurringEssentialProfile: ApiEssentialProfile | null;
  }>(ESSENTIAL_PROFILE_QUERY);
  return data.recurringEssentialProfile;
}

export async function saveEssentialProfile(
  answers: EssentialAnswers,
  run: GqlRunner,
): Promise<EssentialsRun> {
  const data = await run<{ saveRecurringEssentialProfile: EssentialsRun }>(
    SAVE_ESSENTIAL_PROFILE_MUTATION,
    {
      answers: ESSENTIAL_QUESTIONS.map((q) => ({
        question: q.key,
        answer: answers[q.key] ?? '',
      })),
    },
  );
  return data.saveRecurringEssentialProfile;
}

export async function classifyEssentials(
  onlyMissing: boolean,
  run: GqlRunner,
): Promise<EssentialsRun> {
  const data = await run<{ classifyRecurringEssentials: EssentialsRun }>(
    CLASSIFY_ESSENTIALS_MUTATION,
    { onlyMissing },
  );
  return data.classifyRecurringEssentials;
}
