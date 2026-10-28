import { AliasMatchType, Prisma } from '@finnit/database';
import {
  ALIAS_PREVIEW_SAMPLES,
  aliasMatchSql,
  originalTextSql,
  previewAliasSql,
  recomputeAliasesSql,
  regexCheckSql,
} from './merchant-alias.sql';

/** SQL text with collapsed whitespace, for readable assertions. */
const text = (sql: Prisma.Sql) => sql.text.replace(/\s+/g, ' ');

const NORM_TEXT = String.raw`regexp_replace(btrim(unaccent(lower(coalesce(nullif(btrim(t."merchantName"), ''), t."description", '')))), '\s+', ' ', 'g')`;
const NORM_PARAM = String.raw`regexp_replace(btrim(unaccent(lower($2))), '\s+', ' ', 'g')`;
const ESCAPED_PARAM = String.raw`replace(replace(replace(${NORM_PARAM}, '\', '\\'), '%', '\%'), '_', '\_')`;

describe('merchant alias SQL', () => {
  it('reads merchantName, else description, as the original text', () => {
    expect(originalTextSql('t').sql).toBe(
      `coalesce(nullif(btrim(t."merchantName"), ''), t."description", '')`,
    );
  });

  describe('preview (one match type, pattern as a parameter)', () => {
    it('contains: accent/case-insensitive LIKE with the wildcards escaped', () => {
      const sql = previewAliasSql('user-1', AliasMatchType.contains, '50%_off');
      expect(text(sql)).toContain(
        `${NORM_TEXT} LIKE '%' || ${ESCAPED_PARAM} || '%' ESCAPE '\\'`,
      );
      // The pattern is a bound parameter, never interpolated.
      expect(sql.values).toEqual(['user-1', '50%_off', ALIAS_PREVIEW_SAMPLES]);
      expect(sql.sql).not.toContain('50%_off');
    });

    it('starts_with: prefix LIKE', () => {
      const sql = previewAliasSql('u', AliasMatchType.starts_with, 'OXXO');
      expect(text(sql)).toContain(
        `${NORM_TEXT} LIKE ${ESCAPED_PARAM} || '%' ESCAPE '\\'`,
      );
    });

    it('exact: normalized equality', () => {
      const sql = previewAliasSql('u', AliasMatchType.exact, 'Café');
      expect(text(sql)).toContain(`${NORM_TEXT} = ${NORM_PARAM}`);
    });

    it('regex: Postgres ~* on the unaccented text', () => {
      const sql = previewAliasSql('u', AliasMatchType.regex, '^uber\\s');
      expect(text(sql)).toContain(
        `unaccent(coalesce(nullif(btrim(t."merchantName"), ''), t."description", '')) ~* unaccent($2)`,
      );
      expect(sql.sql).not.toContain('LIKE');
    });

    it('returns the newest samples with the total count of matches', () => {
      const sql = text(previewAliasSql('u', AliasMatchType.contains, 'x'));
      expect(sql).toContain('count(*) OVER () AS total');
      expect(sql).toContain('WHERE t."userId" = $1 AND');
      expect(sql).toContain(
        'ORDER BY t."txnDate" DESC, t."createdAt" DESC, t."id" DESC LIMIT $3',
      );
    });
  });

  describe('recompute (match type from the alias row)', () => {
    it('evaluates each alias with a CASE on its match type', () => {
      const sql = text(
        aliasMatchSql(
          Prisma.raw('a."matchType"'),
          originalTextSql('t2'),
          Prisma.raw('a."pattern"'),
        ),
      );
      expect(sql).toMatch(/^\(CASE a\."matchType"::text WHEN 'contains' THEN /);
      expect(sql).toContain(`WHEN 'starts_with' THEN`);
      expect(sql).toContain(`WHEN 'exact' THEN`);
      expect(sql).toContain(`WHEN 'regex' THEN unaccent(`);
      expect(sql).toContain('~* unaccent(a."pattern")');
      expect(sql).toMatch(/ELSE false END\)$/);
    });

    it('picks the active alias with the highest priority, then the newest', () => {
      const sql = recomputeAliasesSql('user-1');
      const flat = text(sql);
      expect(flat).toContain(
        'UPDATE "Transaction" AS t SET "aliasId" = m.alias_id',
      );
      expect(flat).toContain('a."userId" = t2."userId" AND a."active" AND');
      expect(flat).toContain(
        'ORDER BY a."priority" DESC, a."createdAt" DESC, a."id" DESC LIMIT 1',
      );
      expect(flat).toContain('WHERE t2."userId" = $1');
      expect(flat).not.toContain('ANY(');
      expect(sql.values).toEqual(['user-1']);
    });

    it('only fills a missing category (expense/income) and marks it as rule', () => {
      const flat = text(recomputeAliasesSql('u'));
      expect(flat).toContain(
        `"categoryId" = COALESCE(t."categoryId", m.category_id)`,
      );
      expect(flat).toContain(
        `"categorySource" = CASE WHEN t."categoryId" IS NULL AND m.category_id IS NOT NULL THEN 'rule'::"CategorySource" ELSE t."categorySource" END`,
      );
      expect(flat).toContain(
        `CASE WHEN t2."type" IN ('expense', 'income') THEN a."categoryId" END AS category_id`,
      );
      // Only rows whose alias or category changes are written.
      expect(flat).toContain('t."aliasId" IS DISTINCT FROM m.alias_id');
    });

    it('can be limited to some movements (new imports)', () => {
      const sql = recomputeAliasesSql('u', ['t1', 't2']);
      expect(text(sql)).toContain(
        'WHERE t2."userId" = $1 AND t2."id" = ANY($2::text[])',
      );
      expect(sql.values).toEqual(['u', ['t1', 't2']]);
    });
  });

  it('checks a regex by compiling it in Postgres', () => {
    const sql = regexCheckSql('(a');
    expect(sql.text).toBe(`SELECT ('' ~* unaccent($1)) AS ok`);
    expect(sql.values).toEqual(['(a']);
  });
});
