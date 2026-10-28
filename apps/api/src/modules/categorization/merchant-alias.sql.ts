import { AliasMatchType, Prisma } from '@finnit/database';

/**
 * SQL for merchant alias matching (feature 17). Matching always runs in
 * Postgres: plain modes compare `unaccent(lower(...))` with collapsed spaces
 * (LIKE wildcards in the pattern are escaped), and regex uses `~*`, so a
 * user's regular expression is never evaluated in Node.
 */

/** Samples returned by the preview. */
export const ALIAS_PREVIEW_SAMPLES = 20;

/** The movement's original text: merchantName, else description. */
export const originalTextSql = (alias: string): Prisma.Sql =>
  Prisma.raw(
    `coalesce(nullif(btrim(${alias}."merchantName"), ''), ${alias}."description", '')`,
  );

/** Lowercase, no accents, single spaces, trimmed. */
const norm = (value: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`regexp_replace(btrim(unaccent(lower(${value}))), '\\s+', ' ', 'g')`;

/** Escapes LIKE wildcards (escape character: backslash). */
const escapeLike = (value: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`replace(replace(replace(${value}, '\\', '\\\\'), '%', '\\%'), '_', '\\_')`;

function branch(
  matchType: AliasMatchType,
  text: Prisma.Sql,
  pattern: Prisma.Sql,
): Prisma.Sql {
  switch (matchType) {
    case AliasMatchType.contains:
      return Prisma.sql`${norm(text)} LIKE '%' || ${escapeLike(norm(pattern))} || '%' ESCAPE '\\'`;
    case AliasMatchType.starts_with:
      return Prisma.sql`${norm(text)} LIKE ${escapeLike(norm(pattern))} || '%' ESCAPE '\\'`;
    case AliasMatchType.exact:
      return Prisma.sql`${norm(text)} = ${norm(pattern)}`;
    case AliasMatchType.regex:
      return Prisma.sql`unaccent(${text}) ~* unaccent(${pattern})`;
  }
}

/**
 * Condition "the text matches the pattern". With a known match type (the
 * preview) it is that one comparison; with a column (the recompute) it is a
 * CASE, so a row's regex only runs for regex aliases.
 */
export function aliasMatchSql(
  matchType: AliasMatchType | Prisma.Sql,
  text: Prisma.Sql,
  pattern: Prisma.Sql,
): Prisma.Sql {
  if (typeof matchType === 'string') return branch(matchType, text, pattern);
  const cases = Object.values(AliasMatchType).map(
    (type) =>
      Prisma.sql`WHEN ${Prisma.raw(`'${type}'`)} THEN ${branch(type, text, pattern)}`,
  );
  return Prisma.sql`(CASE ${matchType}::text ${Prisma.join(cases, ' ')} ELSE false END)`;
}

/**
 * Recomputes Transaction.aliasId for the user's movements (all, or only
 * `transactionIds`): the active alias with the highest priority (then the
 * newest) whose pattern matches. A matched movement without a category
 * (expense or income) gets the alias category, as source 'rule'; categories
 * already set are never overwritten.
 */
export function recomputeAliasesSql(
  userId: string,
  transactionIds?: string[],
): Prisma.Sql {
  const scope = transactionIds
    ? Prisma.sql`AND t2."id" = ANY(${transactionIds}::text[])`
    : Prisma.empty;
  const match = aliasMatchSql(
    Prisma.raw('a."matchType"'),
    originalTextSql('t2'),
    Prisma.raw('a."pattern"'),
  );
  const newCategory = Prisma.raw(
    `t."categoryId" IS NULL AND m.category_id IS NOT NULL`,
  );
  return Prisma.sql`
UPDATE "Transaction" AS t
SET "aliasId" = m.alias_id,
    "categoryId" = COALESCE(t."categoryId", m.category_id),
    "categorySource" = CASE WHEN ${newCategory} THEN 'rule'::"CategorySource" ELSE t."categorySource" END,
    "suggestedCategoryId" = CASE WHEN ${newCategory} THEN NULL ELSE t."suggestedCategoryId" END,
    "suggestedBy" = CASE WHEN ${newCategory} THEN NULL ELSE t."suggestedBy" END
FROM (
  SELECT t2."id",
         a."id" AS alias_id,
         CASE WHEN t2."type" IN ('expense', 'income') THEN a."categoryId" END AS category_id
  FROM "Transaction" AS t2
  LEFT JOIN LATERAL (
    SELECT a."id", a."categoryId"
    FROM "MerchantAlias" AS a
    WHERE a."userId" = t2."userId" AND a."active" AND ${match}
    ORDER BY a."priority" DESC, a."createdAt" DESC, a."id" DESC
    LIMIT 1
  ) AS a ON true
  WHERE t2."userId" = ${userId} ${scope}
) AS m
WHERE t."id" = m."id"
  AND (t."aliasId" IS DISTINCT FROM m.alias_id OR (${newCategory}))`;
}

export interface AliasPreviewRow {
  id: string;
  original: string;
  txnDate: Date;
  amount: Prisma.Decimal | number | string;
  currency: string;
  total: bigint | number;
}

/** The user's movements a candidate alias would match: newest first, with the total count. */
export function previewAliasSql(
  userId: string,
  matchType: AliasMatchType,
  pattern: string,
): Prisma.Sql {
  const match = aliasMatchSql(
    matchType,
    originalTextSql('t'),
    Prisma.sql`${pattern}`,
  );
  return Prisma.sql`
SELECT t."id", ${originalTextSql('t')} AS original, t."txnDate", t."amount", t."currency",
       count(*) OVER () AS total
FROM "Transaction" AS t
WHERE t."userId" = ${userId} AND ${match}
ORDER BY t."txnDate" DESC, t."createdAt" DESC, t."id" DESC
LIMIT ${ALIAS_PREVIEW_SAMPLES}`;
}

/** Compiles the regex in Postgres (throws invalid_regular_expression). */
export const regexCheckSql = (pattern: string): Prisma.Sql =>
  Prisma.sql`SELECT ('' ~* unaccent(${pattern})) AS ok`;
