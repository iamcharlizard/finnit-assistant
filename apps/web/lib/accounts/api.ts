import type { Translate } from '@/lib/i18n/translator';
import { requestErrorMessage } from '@/lib/graphql/client';
import {
  buildCreateAccountInput,
  buildCreditTermsInput,
  uniqueAccountName,
  type CreditTermsInput,
  type ManualAccountForm,
  type MetadataPatch,
  type TermsChange,
} from './form';

/** Account mutations, run from client components through /api/graphql. */

export const CREATE_ACCOUNT_MUTATION = `mutation CreateAccount($input: CreateAccountInput!) { createAccount(input: $input) { id name } }`;

export const UPDATE_ACCOUNT_MUTATION = `mutation UpdateAccount($id: String!, $input: UpdateAccountInput!) { updateAccount(id: $id, input: $input) { id } }`;

export const SET_CREDIT_CARD_TERMS_MUTATION = `mutation SetCreditCardTerms($accountId: ID!, $input: CreditCardTermsInput!) { setCreditCardTerms(accountId: $accountId, input: $input) { id } }`;

export const REMOVE_CREDIT_CARD_TERMS_MUTATION = `mutation RemoveCreditCardTerms($accountId: ID!) { removeCreditCardTerms(accountId: $accountId) { id } }`;

/** Runs a GraphQL document (the real one is `gql` from lib/graphql/client). */
export type GqlRunner = <T>(
  query: string,
  variables?: Record<string, unknown>,
) => Promise<T>;

/** The API answers a repeated account name with Prisma's unique error. */
export function isDuplicateNameError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? '';
  return /unique constraint/i.test(message) && /name/i.test(message);
}

/** Tries this many names ("X", "X (2)", …) before giving up. */
const NAME_ATTEMPTS = 3;

export interface CreatedAccount {
  id: string;
  name: string;
  /** False when the account exists but its credit terms failed to save. */
  termsSaved: boolean;
  termsError?: unknown;
}

/**
 * Creates a manual account with a name nobody else in the user's accounts
 * has, then (credit cards) its billing terms. The opening balance is
 * recorded by the API as an adjustment.
 */
export async function createManualAccount(
  form: ManualAccountForm,
  {
    baseName,
    existingNames,
    run,
  }: {
    baseName: string;
    existingNames: ReadonlyArray<string>;
    run: GqlRunner;
  },
): Promise<CreatedAccount> {
  const taken = [...existingNames];
  // Validate the terms before creating anything.
  const terms: CreditTermsInput | null =
    form.type === 'credit' ? buildCreditTermsInput(form) : null;

  let created: { id: string; name: string } | null = null;
  for (let attempt = 1; !created; attempt++) {
    const name = uniqueAccountName(baseName, taken);
    try {
      const data = await run<{ createAccount: { id: string; name: string } }>(
        CREATE_ACCOUNT_MUTATION,
        { input: buildCreateAccountInput(form, name) },
      );
      created = data.createAccount;
    } catch (error) {
      // Someone (another tab) took the name meanwhile: try the next one.
      if (!isDuplicateNameError(error) || attempt >= NAME_ATTEMPTS) throw error;
      taken.push(name);
    }
  }

  if (!terms) return { ...created, termsSaved: true };
  try {
    await run(SET_CREDIT_CARD_TERMS_MUTATION, {
      accountId: created.id,
      input: terms,
    });
    return { ...created, termsSaved: true };
  } catch (termsError) {
    return { ...created, termsSaved: false, termsError };
  }
}

/** Saves the edit dialog's changes: metadata first, then the credit terms. */
export async function saveAccountChanges(
  accountId: string,
  { metadata, terms }: { metadata: MetadataPatch | null; terms: TermsChange },
  run: GqlRunner,
): Promise<void> {
  if (metadata) {
    await run(UPDATE_ACCOUNT_MUTATION, {
      id: accountId,
      input: { metadata },
    });
  }
  if (terms?.kind === 'set') {
    await run(SET_CREDIT_CARD_TERMS_MUTATION, {
      accountId,
      input: terms.input,
    });
  } else if (terms?.kind === 'remove') {
    await run(REMOVE_CREDIT_CARD_TERMS_MUTATION, { accountId });
  }
}

export async function setAccountArchived(
  accountId: string,
  archived: boolean,
  run: GqlRunner,
): Promise<void> {
  await run(UPDATE_ACCOUNT_MUTATION, { id: accountId, input: { archived } });
}

/** API validation messages are English; show ours in the user's language. */
const MESSAGES: [RegExp, Parameters<Translate>[0]][] = [
  [/nickname must be/i, 'accounts.errors.nicknameLength'],
  [/hex color/i, 'accounts.errors.hex'],
  [/days of the month/i, 'accounts.errors.day'],
  [/interestRateAnnual/i, 'accounts.errors.rate'],
  [/unique constraint/i, 'accounts.errors.duplicateName'],
  [/account not found/i, 'accounts.errors.notFound'],
];

export function accountErrorMessage(error: unknown, t: Translate): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  const known = MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return t(known[1]);
  const code = (error as { code?: string } | null)?.code;
  if (code === 'INTERNAL_SERVER_ERROR') return t('errors.unexpected');
  return requestErrorMessage(error, t);
}
