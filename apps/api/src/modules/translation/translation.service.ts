import { Injectable, Logger } from '@nestjs/common';
import { AiFeatureKey, TranslationSource } from '@finnit/database';
import { AiModelsService } from '../ai/ai-models.service';
import { APP_LOCALES, AppLocale, normalizeLocale } from './locale';

const GOOGLE_ENDPOINT =
  'https://translation.googleapis.com/language/translate/v2';
const GOOGLE_TIMEOUT_MS = 3_000;
const AI_TIMEOUT_MS = 5_000;

export interface LocalizedName {
  name: string;
  source: TranslationSource;
}

/** A short text (e.g. a category name) in every app locale. */
export type LocalizedNames = Record<AppLocale, LocalizedName>;

interface GoogleTranslateResult {
  data?: {
    translations?: {
      translatedText?: string;
      detectedSourceLanguage?: string;
    }[];
  };
}

const AI_PROMPT = `You translate the name of a personal-finance category (e.g. a spending category in a budgeting app).
Detect the language of the name below and give it in English and in Mexican Spanish.
Keep it short, title-like and natural; keep brand names as they are. If the name is already in one of those languages, return it unchanged for that language.`;

const AI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sourceLanguage: {
      type: 'string',
      description: 'ISO 639-1 code of the input language, e.g. "es"',
    },
    en: { type: 'string', description: 'Name in English' },
    es: { type: 'string', description: 'Name in Mexican Spanish' },
  },
  required: ['sourceLanguage', 'en', 'es'],
};

/**
 * Translates short user texts (category names) to every app locale:
 * Google Cloud Translation v2, then the AI feature `translation`, then the
 * same text in every locale. Never throws.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly aiModels: AiModelsService,
    private readonly apiKey: string | undefined = process.env.GOOGLE_API_KEY,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async translateName(text: string): Promise<LocalizedNames> {
    const input = text.trim();
    if (!input) return this.untranslated(input);

    try {
      const google = await this.withGoogle(input);
      if (google) return google;
    } catch (error) {
      this.logger.warn(
        `Google translation failed: ${(error as Error).message}`,
      );
    }
    try {
      return await this.withAi(input);
    } catch (error) {
      this.logger.warn(`AI translation failed: ${(error as Error).message}`);
    }
    return this.untranslated(input);
  }

  /** The typed text keeps source `user` in its own language. */
  private build(
    text: string,
    detected: string | undefined,
    translated: Partial<Record<AppLocale, string>>,
    source: TranslationSource,
  ): LocalizedNames {
    const names = {} as LocalizedNames;
    for (const locale of APP_LOCALES) {
      names[locale] =
        detected === locale
          ? { name: text, source: TranslationSource.user }
          : { name: translated[locale]?.trim() || text, source };
    }
    return names;
  }

  private untranslated(text: string): LocalizedNames {
    return this.build(text, undefined, {}, TranslationSource.user);
  }

  /** Undefined when Google is not configured. */
  private async withGoogle(text: string): Promise<LocalizedNames | undefined> {
    if (!this.apiKey) return undefined;

    // One call to English usually also tells us the source language; a
    // second one is needed only when the text is not Spanish.
    const en = await this.googleTranslate(text, 'en');
    const detected = normalizeLocale(en.detectedSourceLanguage);
    const translated: Partial<Record<AppLocale, string>> = { en: en.text };
    if (detected !== 'es') {
      translated.es = (await this.googleTranslate(text, 'es')).text;
    }
    return this.build(text, detected, translated, TranslationSource.google);
  }

  private async googleTranslate(
    text: string,
    target: AppLocale,
  ): Promise<{ text: string; detectedSourceLanguage?: string }> {
    // The key goes in a header so it never shows up in URLs or logs.
    const response = await this.fetchFn(GOOGLE_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.apiKey!,
      },
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      body: JSON.stringify({ q: [text], target, format: 'text' }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = (await response.json()) as GoogleTranslateResult;
    const translation = result.data?.translations?.[0];
    if (!translation?.translatedText) throw new Error('empty answer');
    return {
      text: translation.translatedText,
      detectedSourceLanguage: translation.detectedSourceLanguage,
    };
  }

  private async withAi(text: string): Promise<LocalizedNames> {
    const { data } = await this.aiModels.extractFromText(
      {
        prompt: AI_PROMPT,
        text,
        schema: AI_SCHEMA,
        schemaName: 'record_translation',
        timeoutMs: AI_TIMEOUT_MS,
      },
      { feature: AiFeatureKey.translation },
    );
    const answer = (data ?? {}) as Record<string, unknown>;
    const pick = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value.trim() : undefined;
    const en = pick(answer.en);
    const es = pick(answer.es);
    if (!en || !es) throw new Error('the answer has no translation');
    return this.build(
      text,
      normalizeLocale(answer.sourceLanguage),
      { en, es },
      TranslationSource.ai,
    );
  }
}
