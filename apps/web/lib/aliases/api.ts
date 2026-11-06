import type { GqlRunner } from '@/lib/accounts/api';
import { requestErrorMessage } from '@/lib/graphql/client';
import type { Translate } from '@/lib/i18n/translator';
import { buildAliasInput, withActive, type AliasForm } from './form';
import {
  ALIAS_PREVIEW_FIELDS,
  MERCHANT_ALIAS_FIELDS,
  type AliasPatternSuggestion,
  type AliasPreview,
  type ApiMerchantAlias,
  type MerchantAliasInput,
} from './types';

/** Alias and learned-rule GraphQL, run from client components through /api/graphql. */

export const CREATE_ALIAS_MUTATION = `mutation CreateMerchantAlias($input: MerchantAliasInput!) { createMerchantAlias(input: $input) { ${MERCHANT_ALIAS_FIELDS} } }`;

export const UPDATE_ALIAS_MUTATION = `mutation UpdateMerchantAlias($id: ID!, $input: MerchantAliasInput!) { updateMerchantAlias(id: $id, input: $input) { ${MERCHANT_ALIAS_FIELDS} } }`;

export const DELETE_ALIAS_MUTATION = `mutation DeleteMerchantAlias($id: ID!) { deleteMerchantAlias(id: $id) }`;

export const PREVIEW_ALIAS_QUERY = `query PreviewMerchantAlias($input: MerchantAliasInput!, $aliasId: ID) { previewMerchantAlias(input: $input, aliasId: $aliasId) { ${ALIAS_PREVIEW_FIELDS} } }`;

export const SUGGEST_ALIAS_PATTERN_MUTATION = `mutation SuggestAliasPattern($input: SuggestAliasPatternInput!) { suggestAliasPattern(input: $input) { matchType pattern explanation source coversAll aiUnavailable preview { ${ALIAS_PREVIEW_FIELDS} } } }`;

export const DELETE_RULE_MUTATION = `mutation DeleteMerchantRule($id: ID!) { deleteMerchantRule(id: $id) }`;

/** Creates (no id) or updates an alias from a valid form. */
export async function saveAlias(
  form: AliasForm,
  id: string | null,
  run: GqlRunner,
): Promise<ApiMerchantAlias> {
  const input = buildAliasInput(form);
  if (id) {
    const data = await run<{ updateMerchantAlias: ApiMerchantAlias }>(
      UPDATE_ALIAS_MUTATION,
      { id, input },
    );
    return data.updateMerchantAlias;
  }
  const data = await run<{ createMerchantAlias: ApiMerchantAlias }>(
    CREATE_ALIAS_MUTATION,
    { input },
  );
  return data.createMerchantAlias;
}

export async function setAliasActive(
  alias: ApiMerchantAlias,
  active: boolean,
  run: GqlRunner,
): Promise<void> {
  await run(UPDATE_ALIAS_MUTATION, {
    id: alias.id,
    input: withActive(alias, active),
  });
}

export async function deleteAlias(id: string, run: GqlRunner): Promise<void> {
  await run(DELETE_ALIAS_MUTATION, { id });
}

export async function deleteRule(id: string, run: GqlRunner): Promise<void> {
  await run(DELETE_RULE_MUTATION, { id });
}

export async function previewAlias(
  input: MerchantAliasInput,
  run: GqlRunner,
  aliasId: string | null = null,
): Promise<AliasPreview> {
  const data = await run<{ previewMerchantAlias: AliasPreview }>(
    PREVIEW_ALIAS_QUERY,
    { input, aliasId },
  );
  return data.previewMerchantAlias;
}

/** A pattern (AI first) for movements that should share an automatic name. */
export async function suggestAliasPattern(
  transactionIds: string[],
  run: GqlRunner,
): Promise<AliasPatternSuggestion> {
  const data = await run<{ suggestAliasPattern: AliasPatternSuggestion }>(
    SUGGEST_ALIAS_PATTERN_MUTATION,
    { input: { transactionIds } },
  );
  return data.suggestAliasPattern;
}

/** A regex the API refused: its own message goes under the pattern field. */
export function regexErrorOf(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? '';
  return /regular expression|regex|pattern/i.test(message) ? message : null;
}

/** API messages are English; show ours in the user's language. */
const MESSAGES: [RegExp, Parameters<Translate>[0]][] = [
  [/already exists|unique constraint/i, 'aliases.errors.duplicate'],
  [/alias not found/i, 'aliases.errors.notFound'],
  [/category not found/i, 'aliases.errors.category'],
  [/privacy pin to continue/i, 'aliases.errors.locked'],
  [/create your privacy pin/i, 'aliases.errors.noPin'],
];

export function aliasErrorMessage(error: unknown, t: Translate): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  const known = MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return t(known[1]);
  const code = (error as { code?: string } | null)?.code;
  if (code === 'INTERNAL_SERVER_ERROR') return t('errors.unexpected');
  return requestErrorMessage(error, t);
}
