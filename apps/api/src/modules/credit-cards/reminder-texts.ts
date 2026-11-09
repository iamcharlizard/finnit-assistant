import type { ReminderKind } from './credit-card-cycle';

/** What a card reminder says, in the user's language. */
export interface ReminderFacts {
  card: string;
  currency: string;
  /** The no-interest payment (statement) or what is left of it. */
  amount: number;
  /** The due date, YYYY-MM-DD. */
  dueDate: string;
  /** Added by hand: the user records the interest. */
  manual: boolean;
}

const money = (amount: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-MX', {
    style: 'currency',
    currency,
  }).format(amount);

const day = (key: string, locale: string) =>
  new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${key}T00:00:00Z`));

export function reminderTexts(
  kind: ReminderKind,
  locale: string,
  facts: ReminderFacts,
): { title: string; message: string } {
  const amount = money(facts.amount, facts.currency, locale);
  const date = day(facts.dueDate, locale);
  const { card } = facts;
  if (locale === 'en') {
    switch (kind) {
      case 'statement':
        return {
          title: `${card}: statement closed`,
          message: `Pay ${amount} by ${date} to avoid interest.`,
        };
      case 'due_soon':
        return {
          title: `${card}: payment due in 3 days`,
          message: `${amount} left to pay by ${date} to avoid interest.`,
        };
      case 'due_today':
        return {
          title: `${card}: payment due today`,
          message: `${amount} left to pay today to avoid interest.`,
        };
      case 'unpaid':
        return {
          title: `${card}: payment not covered`,
          message: facts.manual
            ? `${amount} was left unpaid, so it will charge interest. Record the interest from your statement.`
            : `${amount} was left unpaid, so it will charge interest.`,
        };
    }
  }
  switch (kind) {
    case 'statement':
      return {
        title: `${card}: cerró tu corte`,
        message: `Paga ${amount} antes del ${date} para no generar intereses.`,
      };
    case 'due_soon':
      return {
        title: `${card}: tu pago vence en 3 días`,
        message: `Faltan ${amount} para no generar intereses (fecha límite: ${date}).`,
      };
    case 'due_today':
      return {
        title: `${card}: hoy vence tu pago`,
        message: `Faltan ${amount} para no generar intereses.`,
      };
    case 'unpaid':
      return {
        title: `${card}: no se cubrió el pago`,
        message: facts.manual
          ? `Quedaron ${amount} sin pagar y generarán intereses. Registra los intereses de tu estado de cuenta.`
          : `Quedaron ${amount} sin pagar y generarán intereses.`,
      };
  }
}
