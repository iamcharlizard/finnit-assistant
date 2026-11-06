/** The live "movements to review" notification's key. */
export const REVIEW_ENTITY_TYPE = 'uncategorized_transactions';

/**
 * Texts of the notification about what is left after a sync: movements
 * without a category and possible transfers, in the user's language.
 */
export function reviewTexts(
  locale: string,
  { uncategorized, transfers }: { uncategorized: number; transfers: number },
): { title: string; message: string } {
  if (locale === 'en') {
    const parts = [
      uncategorized > 0
        ? `${uncategorized} ${uncategorized === 1 ? 'movement has' : 'movements have'} no category`
        : null,
      transfers > 0
        ? `${transfers} ${transfers === 1 ? 'movement looks' : 'movements look'} like a transfer between your accounts`
        : null,
    ].filter(Boolean);
    return {
      title: 'Movements to review',
      message: `${parts.join(' and ')}. Review them so your reports add up.`,
    };
  }
  const parts = [
    uncategorized > 0
      ? `${uncategorized} ${uncategorized === 1 ? 'movimiento sin clasificar' : 'movimientos sin clasificar'}`
      : null,
    transfers > 0
      ? `${transfers} ${transfers === 1 ? 'posible transferencia' : 'posibles transferencias'} entre tus cuentas`
      : null,
  ].filter(Boolean);
  return {
    title: 'Movimientos por revisar',
    message: `Tienes ${parts.join(' y ')}. Revísalos para que tus reportes cuadren.`,
  };
}
