import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AiFeatureKey } from '@finnit/database';
import { AiModelsService } from '../ai/ai-models.service';
import { TranslationService } from './translation.service';

const googleAnswer = (translatedText: string, detected = 'es') =>
  new Response(
    JSON.stringify({
      data: {
        translations: [{ translatedText, detectedSourceLanguage: detected }],
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

type FetchMock = jest.Mock<Promise<Response>, Parameters<typeof fetch>>;
const sent = (mock: FetchMock, call = 0) =>
  JSON.parse(mock.mock.calls[call][1]!.body as string) as {
    q: string[];
    target: string;
  };

describe('TranslationService', () => {
  let aiModels: DeepMockProxy<AiModelsService>;
  let fetchFn: FetchMock;

  beforeEach(() => {
    aiModels = mockDeep<AiModelsService>();
    fetchFn = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
  });

  describe('with Google', () => {
    it('Spanish input: one call, the typed text stays as es (user)', async () => {
      fetchFn.mockResolvedValueOnce(googleAnswer('Pets', 'es'));
      const service = new TranslationService(aiModels, 'g-key', fetchFn);

      const names = await service.translateName(' Mascotas ');

      expect(names).toEqual({
        en: { name: 'Pets', source: 'google' },
        es: { name: 'Mascotas', source: 'user' },
      });
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(sent(fetchFn)).toEqual({
        q: ['Mascotas'],
        target: 'en',
        format: 'text',
      });
      const init = fetchFn.mock.calls[0][1]!;
      expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(
        'g-key',
      );
      expect(fetchFn.mock.calls[0][0] as string).not.toContain('g-key');
      expect(aiModels.extractFromText).not.toHaveBeenCalled();
    });

    it('English input: translates to Spanish too', async () => {
      fetchFn
        .mockResolvedValueOnce(googleAnswer('Pets', 'en'))
        .mockResolvedValueOnce(googleAnswer('Mascotas', 'en'));
      const service = new TranslationService(aiModels, 'g-key', fetchFn);

      const names = await service.translateName('Pets');

      expect(names).toEqual({
        en: { name: 'Pets', source: 'user' },
        es: { name: 'Mascotas', source: 'google' },
      });
      expect(sent(fetchFn, 1).target).toBe('es');
    });

    it('other languages: both locales come from Google', async () => {
      fetchFn
        .mockResolvedValueOnce(googleAnswer('Pets', 'pt'))
        .mockResolvedValueOnce(googleAnswer('Mascotas', 'pt'));
      const service = new TranslationService(aiModels, 'g-key', fetchFn);

      const names = await service.translateName('Animais');

      expect(names.en.source).toBe('google');
      expect(names.es).toEqual({ name: 'Mascotas', source: 'google' });
    });
  });

  describe('fallbacks', () => {
    it('uses the AI feature `translation` when Google fails', async () => {
      fetchFn.mockResolvedValue(new Response('{}', { status: 403 }));
      aiModels.extractFromText.mockResolvedValue({
        model: {} as never,
        data: { sourceLanguage: 'es', en: 'Pets', es: 'Mascotas' },
      });
      const service = new TranslationService(aiModels, 'g-key', fetchFn);

      const names = await service.translateName('Mascotas');

      expect(names).toEqual({
        en: { name: 'Pets', source: 'ai' },
        es: { name: 'Mascotas', source: 'user' },
      });
      expect(aiModels.extractFromText).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Mascotas', timeoutMs: 5000 }),
        { feature: AiFeatureKey.translation },
      );
    });

    it('uses AI directly when Google is not configured', async () => {
      aiModels.extractFromText.mockResolvedValue({
        model: {} as never,
        data: { sourceLanguage: 'en', en: 'Pets', es: 'Mascotas' },
      });
      const service = new TranslationService(aiModels, undefined, fetchFn);

      const names = await service.translateName('Pets');

      expect(fetchFn).not.toHaveBeenCalled();
      expect(names.es).toEqual({ name: 'Mascotas', source: 'ai' });
    });

    it('keeps the typed text everywhere when everything fails', async () => {
      fetchFn.mockRejectedValue(new Error('timeout'));
      aiModels.extractFromText.mockRejectedValue(new Error('feature off'));
      const service = new TranslationService(aiModels, 'g-key', fetchFn);

      await expect(service.translateName('Mascotas')).resolves.toEqual({
        en: { name: 'Mascotas', source: 'user' },
        es: { name: 'Mascotas', source: 'user' },
      });
    });

    it('rejects an AI answer without both names', async () => {
      aiModels.extractFromText.mockResolvedValue({
        model: {} as never,
        data: { en: 'Pets' },
      });
      const service = new TranslationService(aiModels, undefined, fetchFn);

      const names = await service.translateName('Mascotas');

      expect(names.en).toEqual({ name: 'Mascotas', source: 'user' });
    });
  });
});
