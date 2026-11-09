/**
 * Linking an expense on a credit card to a purchase in installments, from
 * the movement's detail: it is the card's charge of the whole purchase, or
 * the charge of one monthly installment. Shared by the web and the mobile
 * app.
 */
import type { GqlRunner } from '../graphql/request';
import { dayKeyOf, shortDate } from '../finance/dates';
import { formatMoney } from '../finance/money';
import type { Localizer } from '../i18n/translator';
import {
  LINK_LOAN_PAYMENT_MUTATION,
  UNLINK_LOAN_PAYMENT_MUTATION,
} from './links';
import type { CardInstallmentPrefill } from './card-installments';

export interface ApiCardInstallmentTarget {
  occurrenceId: string;
  number: number;
  dueDate: string;
  amount: number;
  fits: boolean;
  state: 'open' | 'overdue' | 'paid_without_movement';
}

export interface ApiCardInstallmentPlan {
  debtId: string;
  name: string;
  principal: number;
  installmentsTotal: number;
  installmentAmount: number;
  purchaseDate: string;
  purchaseLinked: boolean;
  canLinkPurchase: boolean;
  purchaseFits: boolean;
  nameMatches: boolean;
  installments: ApiCardInstallmentTarget[];
}

export interface ApiCardInstallmentLinked {
  debtId: string;
  name: string;
  purchase: boolean;
  occurrenceId: string | null;
  number: number | null;
  installmentsTotal: number;
}

export interface ApiCardInstallmentLinkOptions {
  accountId: string;
  linked: ApiCardInstallmentLinked | null;
  suggestedDebtId: string | null;
  suggestedOccurrenceId: string | null;
  plans: ApiCardInstallmentPlan[];
}

export const CARD_INSTALLMENT_LINK_OPTIONS_QUERY = `query CardInstallmentLinkOptions($transactionId: ID!) {
  cardInstallmentLinkOptions(transactionId: $transactionId) {
    accountId suggestedDebtId suggestedOccurrenceId
    linked { debtId name purchase occurrenceId number installmentsTotal }
    plans { debtId name principal installmentsTotal installmentAmount purchaseDate purchaseLinked canLinkPurchase purchaseFits nameMatches installments { occurrenceId number dueDate amount fits state } }
  }
}`;

export const LINK_CARD_INSTALLMENT_PURCHASE_MUTATION = `mutation LinkCardInstallmentPurchase($debtId: ID!, $transactionId: ID!) { linkCardInstallmentPurchase(debtId: $debtId, transactionId: $transactionId) { id } }`;

export const UNLINK_CARD_INSTALLMENT_PURCHASE_MUTATION = `mutation UnlinkCardInstallmentPurchase($debtId: ID!) { unlinkCardInstallmentPurchase(debtId: $debtId) { id } }`;

export async function loadCardInstallmentLinkOptions(
  transactionId: string,
  run: GqlRunner,
): Promise<ApiCardInstallmentLinkOptions> {
  const data = await run<{
    cardInstallmentLinkOptions: ApiCardInstallmentLinkOptions;
  }>(CARD_INSTALLMENT_LINK_OPTIONS_QUERY, { transactionId });
  return data.cardInstallmentLinkOptions;
}

/** What the user picked: the purchase of a plan, or one installment. */
export type CardInstallmentChoice =
  | { kind: 'purchase'; debtId: string }
  | { kind: 'installment'; debtId: string; occurrenceId: string };

export const choiceKey = (choice: CardInstallmentChoice): string =>
  choice.kind === 'purchase'
    ? `purchase:${choice.debtId}`
    : `installment:${choice.occurrenceId}`;

export async function linkCardInstallment(
  transactionId: string,
  choice: CardInstallmentChoice,
  run: GqlRunner,
): Promise<void> {
  if (choice.kind === 'purchase') {
    await run(LINK_CARD_INSTALLMENT_PURCHASE_MUTATION, {
      debtId: choice.debtId,
      transactionId,
    });
  } else {
    await run(LINK_LOAN_PAYMENT_MUTATION, {
      occurrenceId: choice.occurrenceId,
      transactionId,
    });
  }
}

/** Undoes the current link (an installment reopens). */
export async function unlinkCardInstallment(
  linked: ApiCardInstallmentLinked,
  run: GqlRunner,
): Promise<void> {
  if (linked.purchase) {
    await run(UNLINK_CARD_INSTALLMENT_PURCHASE_MUTATION, {
      debtId: linked.debtId,
    });
  } else if (linked.occurrenceId) {
    await run(UNLINK_LOAN_PAYMENT_MUTATION, {
      occurrenceId: linked.occurrenceId,
      keepPaid: false,
    });
  }
}

/** The choice to start with: what the API suggests, else nothing. */
export function initialCardInstallmentChoice(
  options: ApiCardInstallmentLinkOptions,
): CardInstallmentChoice | null {
  if (!options.suggestedDebtId) return null;
  return options.suggestedOccurrenceId
    ? {
        kind: 'installment',
        debtId: options.suggestedDebtId,
        occurrenceId: options.suggestedOccurrenceId,
      }
    : { kind: 'purchase', debtId: options.suggestedDebtId };
}

export interface CardInstallmentOptionRow {
  key: string;
  choice: CardInstallmentChoice;
  title: string;
  meta: string;
  proposed: boolean;
  fits: boolean;
}

export interface CardInstallmentPlanView {
  debtId: string;
  name: string;
  /** "$6,000.00 · 6 meses" style line under the name. */
  detail: string;
  /** Why it can't take this movement, when it can't. */
  note: string | null;
  rows: CardInstallmentOptionRow[];
}

export interface CardInstallmentLinkView {
  /** "Es la mensualidad 3 de 12 de Pantalla." */
  linked: string | null;
  plans: CardInstallmentPlanView[];
}

export function toCardInstallmentLinkView(
  options: ApiCardInstallmentLinkOptions,
  currency: string,
  { locale, t }: Localizer,
): CardInstallmentLinkView {
  const money = (n: number) => formatMoney(n, currency, locale);
  const date = (iso: string) => shortDate(dayKeyOf(iso), locale);
  const linked = options.linked
    ? options.linked.purchase
      ? t('transaction.linkCardInstallment.linkedPurchase', {
          name: options.linked.name,
        })
      : t('transaction.linkCardInstallment.linkedInstallment', {
          name: options.linked.name,
          number: options.linked.number ?? 0,
          total: options.linked.installmentsTotal,
        })
    : null;

  const plans = options.plans.map((plan) => {
    const rows: CardInstallmentOptionRow[] = [];
    if (plan.canLinkPurchase) {
      const choice: CardInstallmentChoice = {
        kind: 'purchase',
        debtId: plan.debtId,
      };
      rows.push({
        key: choiceKey(choice),
        choice,
        title: t('transaction.linkCardInstallment.purchase'),
        meta: t('transaction.linkCardInstallment.purchaseMeta', {
          amount: money(plan.principal),
          date: date(plan.purchaseDate),
        }),
        proposed:
          options.suggestedDebtId === plan.debtId &&
          !options.suggestedOccurrenceId,
        fits: plan.purchaseFits,
      });
    }
    for (const target of plan.installments) {
      const choice: CardInstallmentChoice = {
        kind: 'installment',
        debtId: plan.debtId,
        occurrenceId: target.occurrenceId,
      };
      const amount = money(target.amount);
      rows.push({
        key: choiceKey(choice),
        choice,
        title: t('transaction.linkCardInstallment.installment', {
          number: target.number,
          total: plan.installmentsTotal,
        }),
        meta:
          target.state === 'paid_without_movement'
            ? t('transaction.linkCardInstallment.paidWithout', { amount })
            : t('transaction.linkCardInstallment.installmentMeta', {
                amount,
                date: date(target.dueDate),
              }),
        proposed: options.suggestedOccurrenceId === target.occurrenceId,
        fits: target.fits,
      });
    }
    // The ones that fit first, then by installment.
    rows.sort((a, b) => Number(b.fits) - Number(a.fits));
    return {
      debtId: plan.debtId,
      name: plan.name,
      detail: t('debts.cardInstallments.preview', {
        count: plan.installmentsTotal,
        amount: money(plan.installmentAmount),
        total: money(plan.principal),
      }),
      note: plan.purchaseLinked
        ? t('transaction.linkCardInstallment.billedByCard')
        : !plan.canLinkPurchase && rows.length === 0
          ? t('transaction.linkCardInstallment.purchaseBlocked')
          : null,
      rows,
    };
  });
  return { linked, plans };
}

/** "Crear compra a meses con este gasto": the form starts from the expense. */
export function cardInstallmentPrefill(transaction: {
  id: string;
  accountId: string;
  amount: number;
  txnDate: string;
  name: string;
}): CardInstallmentPrefill {
  return {
    name: transaction.name,
    accountId: transaction.accountId,
    principal: transaction.amount.toFixed(2),
    purchaseDate: dayKeyOf(transaction.txnDate),
    purchaseTransactionId: transaction.id,
  };
}
