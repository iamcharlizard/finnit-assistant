/**
 * Comparing a linked account's recorded movements with the bank's balance.
 *
 * Since the last reconciliation the bank's balance should have moved by
 * exactly what the movements recorded since then did (imported or typed by
 * hand). Whatever is left is kept as one open adjustment, "Diferencia con
 * el banco", so the balance always equals the bank's and the past days
 * don't shift. When the missing movements are recorded later, the next
 * reconciliation shrinks that adjustment back to zero.
 */

/** Differences smaller than this (rounding, cents) are ignored. */
export const DIFFERENCE_TOLERANCE = 1;

const cents = (value: number) => Math.round(value * 100) / 100;

export interface Reconciliation {
  /** What the bank's balance should be by the recorded movements. */
  expected: number;
  /** The open adjustment's new effect; 0 = none. */
  openDifference: number;
}

export function reconcileBalance({
  bankBalance,
  reconciledBalance,
  recordedSince,
  openDifference,
}: {
  bankBalance: number;
  /** The bank's balance at the last reconciliation. */
  reconciledBalance: number;
  /** Sum of the effects of the movements recorded since then. */
  recordedSince: number;
  /** The open adjustment's current effect (0 = none). */
  openDifference: number;
}): Reconciliation {
  const expected = cents(reconciledBalance + recordedSince);
  const open = cents(openDifference + (bankBalance - expected));
  return {
    expected,
    openDifference: Math.abs(open) < DIFFERENCE_TOLERANCE ? 0 : open,
  };
}

/** Texts of the mismatch notification and adjustment, in the user's language. */
export function mismatchTexts(
  locale: string,
  {
    account,
    difference,
    currency,
  }: { account: string; difference: number; currency: string },
): { title: string; message: string; adjustment: string } {
  const amount = `${Math.abs(difference).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
  if (locale === 'en') {
    return {
      title: `${account}: the balance doesn't match the bank`,
      message:
        difference > 0
          ? `The bank shows ${amount} more than your recorded movements: money in may be missing. We saved it as "Difference with the bank"; record what's missing and it fixes itself.`
          : `The bank shows ${amount} less than your recorded movements: spending may be missing. We saved it as "Difference with the bank"; record what's missing and it fixes itself.`,
      adjustment: 'Difference with the bank',
    };
  }
  return {
    title: `${account}: el saldo no coincide con el banco`,
    message:
      difference > 0
        ? `El banco tiene ${amount} más que tus movimientos registrados: puede faltar algún ingreso. Lo guardamos como "Diferencia con el banco"; registra lo que falta y se ajusta solo.`
        : `El banco tiene ${amount} menos que tus movimientos registrados: puede faltar algún gasto. Lo guardamos como "Diferencia con el banco"; registra lo que falta y se ajusta solo.`,
    adjustment: 'Diferencia con el banco',
  };
}

/** Texts of the notification for a movement the bank cancelled, in the user's language. */
export function cancelledTexts(
  locale: string,
  {
    name,
    amount,
    currency,
    marked,
  }: { name: string; amount: number; currency: string; marked: boolean },
): { title: string; message: string } {
  const money = `${Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
  if (locale === 'en') {
    return {
      title: `The bank cancelled ${name}`,
      message: marked
        ? `${name} for ${money} no longer shows at your bank: we marked it Cancelled, so it no longer counts. Check it on your statement; you can reactivate it from the movement.`
        : `${name} for ${money} no longer shows at your bank, but it is linked to a transfer or a loan: review it.`,
    };
  }
  return {
    title: `El banco canceló ${name}`,
    message: marked
      ? `${name} por ${money} ya no aparece en tu banco: lo marcamos como Cancelado y ya no cuenta. Revísalo en tu estado de cuenta; puedes reactivarlo desde el movimiento.`
      : `${name} por ${money} ya no aparece en tu banco, pero está ligado a una transferencia o a un préstamo: revísalo.`,
  };
}
