import { AccountType, ImportedLineKind } from '@finnit/database';
import { SyncfyAccount, SyncfyTransaction } from './syncfy.client';

/** Syncfy account types that behave like a credit card in Finnit. */
const CREDIT_TYPES = new Set(['Credit Card', 'Line of Credit']);

/** "(007:012)" — monthly installment of a "meses sin intereses" plan. */
const INSTALLMENT =
  /\(\s*(\d{1,3})\s*[:/]\s*(\d{1,3})\s*\)|\b(\d{1,3}) de (\d{1,3})\b/i;
/** Bank reference number some descriptions start with. */
const LEADING_REFERENCE = /^\d{6,}\s+/;
/** Merchant tax id appended by the bank: "NME 110513PI3", "ANE 140618P37MX". */
const MERCHANT_RFC = /\s+[A-Z&Ñ]{3,4}\s?\d{6}[A-Z0-9]{2,3}(MX)?$/;
/** Card payment received ("SU ABONO...GRACIAS", "PAGO"). */
const CARD_PAYMENT = /ABONO|PAGO|GRACIAS/i;

export function isCreditAccount(account: Pick<SyncfyAccount, 'account_type'>) {
  return CREDIT_TYPES.has(account.account_type);
}

/** Finnit account type suggested for a Syncfy account. */
export function suggestedAccountType(account: SyncfyAccount): AccountType {
  if (isCreditAccount(account)) return AccountType.credit;
  if (account.account_type === 'Savings') return AccountType.savings;
  if (account.account_type === 'Digital Wallet') return AccountType.ewallet;
  return AccountType.debit;
}

/** Only the last 4 digits are kept. */
export function maskNumber(number?: string | null): string | undefined {
  const digits = (number ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

export function toNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? parsed
    : undefined;
}

/**
 * Syncfy's dt_operation is midnight UTC of the operation day (dt_transaction
 * is the same day at midnight in Mexico City), so the UTC date is the day.
 */
export function operationDate(transaction: SyncfyTransaction): Date {
  const seconds = transaction.extra?.dt_operation ?? transaction.dt_transaction;
  const date = new Date(seconds * 1000);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function postingDate(transaction: SyncfyTransaction): Date | undefined {
  const seconds = transaction.extra?.dt_application;
  if (!seconds) return undefined;
  const date = new Date(seconds * 1000);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export interface MappedLine {
  providerTxnId: string;
  date: Date;
  postDate?: Date;
  description: string;
  merchant: string;
  /** Positive; `kind` gives the direction. */
  amount: number;
  kind: ImportedLineKind;
  installmentNumber?: number;
  installmentTotal?: number;
  currency: string;
}

/**
 * Maps a Syncfy movement to an import line. Syncfy amounts are signed from
 * the account's point of view: negative is money out (a charge), positive is
 * money in (a deposit, or a payment/refund on a card).
 */
export function mapTransaction(
  transaction: SyncfyTransaction,
  account: Pick<SyncfyAccount, 'account_type' | 'currency'>,
): MappedLine {
  const description = (transaction.description ?? '')
    .replace(LEADING_REFERENCE, '')
    .replace(/\s+/g, ' ')
    .trim();
  const installment = INSTALLMENT.exec(description);
  const installmentNumber = installment
    ? Number(installment[1] ?? installment[3])
    : undefined;
  const installmentTotal = installment
    ? Number(installment[2] ?? installment[4])
    : undefined;
  const amount = Math.round(Math.abs(transaction.amount) * 100) / 100;
  const moneyIn = transaction.amount > 0;
  const credit = isCreditAccount(account);

  let kind: ImportedLineKind;
  if (moneyIn) {
    kind = !credit
      ? ImportedLineKind.deposit
      : CARD_PAYMENT.test(description)
        ? ImportedLineKind.payment
        : ImportedLineKind.refund;
  } else if (installment && credit) {
    kind = ImportedLineKind.installment;
  } else if (/INTERES/i.test(description)) {
    kind = ImportedLineKind.interest;
  } else if (/COMISION|ANUALIDAD/i.test(description)) {
    kind = ImportedLineKind.fee;
  } else {
    kind = ImportedLineKind.charge;
  }

  const merchant =
    description
      .replace(INSTALLMENT, '')
      .replace(MERCHANT_RFC, '')
      .replace(/\s+/g, ' ')
      .trim() || description;

  return {
    providerTxnId: transaction.id_transaction,
    date: operationDate(transaction),
    postDate: postingDate(transaction),
    description,
    merchant,
    amount,
    kind,
    installmentNumber:
      kind === ImportedLineKind.installment ? installmentNumber : undefined,
    installmentTotal:
      kind === ImportedLineKind.installment ? installmentTotal : undefined,
    currency: (transaction.currency ?? account.currency ?? 'MXN').toUpperCase(),
  };
}
