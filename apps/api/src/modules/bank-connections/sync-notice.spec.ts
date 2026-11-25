import { syncNoticeTexts } from './sync-notice';

describe('syncNoticeTexts', () => {
  it('says how many new movements came', () => {
    expect(syncNoticeTexts('es', { bank: 'Nu', ok: true, created: 3 })).toEqual(
      {
        title: 'Nu se actualizó',
        message: '3 movimientos nuevos.',
      },
    );
    expect(
      syncNoticeTexts('en', { bank: 'Nu', ok: true, created: 0 }).message,
    ).toBe('No new movements since the last update.');
  });

  it('gives the reason in the user language', () => {
    const texts = syncNoticeTexts('es', {
      bank: 'BBVA',
      ok: false,
      created: 0,
      code: 401,
    });
    expect(texts.title).toBe('No pudimos actualizar BBVA');
    expect(texts.message).toMatch(/^El banco rechazó tus datos de acceso\./);
  });

  it('names the bank generically when unknown', () => {
    expect(
      syncNoticeTexts('en', { bank: null, ok: false, created: 0 }).title,
    ).toBe("Your bank couldn't be updated");
  });
});
