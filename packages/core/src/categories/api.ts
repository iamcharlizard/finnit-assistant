import type { GqlRunner } from '@finnit/core/graphql/request';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import type { Translate } from '@finnit/core/i18n/translator';
import type { CategoryReferences } from '@finnit/core/categories/view';
import { CATEGORY_NAME_MAX, type CategoryKind } from '@finnit/core/categories/types';

/** Category settings GraphQL, run from client components through /api/graphql. */

export const CREATE_CATEGORY_MUTATION = `mutation CreateCategory($input: CreateCategoryInput!) { createCategory(input: $input) { id } }`;
export const UPDATE_CATEGORY_MUTATION = `mutation UpdateCategory($id: String!, $input: UpdateCategoryInput!) { updateCategory(id: $id, input: $input) { id } }`;
export const DELETE_CATEGORY_MUTATION = `mutation DeleteCategory($id: String!, $moveToId: String) { deleteCategory(id: $id, moveToId: $moveToId) }`;
export const HIDE_CATEGORY_MUTATION = `mutation HideCategory($id: String!) { hideCategory(id: $id) }`;
export const SHOW_CATEGORY_MUTATION = `mutation ShowCategory($id: String!) { showCategory(id: $id) }`;
export const CATEGORY_REFERENCES_QUERY = `query CategoryReferences($id: String!) { categoryReferences(id: $id) { transactions children budgetCaps rules aliases recurring } }`;

export interface CategoryForm {
  name: string;
  kind: CategoryKind;
  /** Empty: a main category. */
  parentId: string;
  /** Empty: picked by name. */
  icon: string;
}

export type CategoryFormError = 'nameRequired' | 'nameTooLong';

export function validateCategoryForm(
  form: CategoryForm,
): CategoryFormError | null {
  const name = form.name.trim();
  if (!name) return 'nameRequired';
  if (name.length > CATEGORY_NAME_MAX) return 'nameTooLong';
  return null;
}

/** The API input: a subcategory takes its parent's kind, so none is sent. */
export function categoryInput(form: CategoryForm) {
  return {
    name: form.name.trim(),
    parentId: form.parentId || null,
    ...(form.parentId ? {} : { kind: form.kind }),
    icon: form.icon || null,
  };
}

export async function saveCategory(
  form: CategoryForm,
  id: string | null,
  run: GqlRunner,
): Promise<void> {
  const input = categoryInput(form);
  if (id) await run(UPDATE_CATEGORY_MUTATION, { id, input });
  else await run(CREATE_CATEGORY_MUTATION, { input });
}

export async function categoryReferences(
  id: string,
  run: GqlRunner,
): Promise<CategoryReferences> {
  const data = await run<{ categoryReferences: CategoryReferences }>(
    CATEGORY_REFERENCES_QUERY,
    { id },
  );
  return data.categoryReferences;
}

/** The API's message for a name already taken, else the generic one. */
export function categoryErrorMessage(error: unknown, t: Translate): string {
  const message = error instanceof Error ? error.message : '';
  if (/already exists/i.test(message)) return t('categories.errors.duplicate');
  if (/two levels/i.test(message)) return t('categories.errors.depth');
  return requestErrorMessage(error, t);
}
