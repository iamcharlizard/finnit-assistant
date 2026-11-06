-- Every user has one cash account ("Efectivo") that can't be deleted.
BEGIN;

ALTER TABLE "Account" ADD COLUMN "isDefaultCash" BOOLEAN NOT NULL DEFAULT false;

-- At most one per user.
CREATE UNIQUE INDEX "Account_userId_default_cash_key" ON "Account"("userId") WHERE "isDefaultCash";

-- Users who already have a cash account: their oldest open one.
UPDATE "Account" AS a
SET "isDefaultCash" = true
FROM (
  SELECT DISTINCT ON ("userId") "id"
  FROM "Account"
  WHERE "type" = 'cash' AND NOT "archived"
  ORDER BY "userId", "createdAt", "id"
) AS oldest
WHERE a."id" = oldest."id";

-- Everyone else gets a new one, named in their language ("Efectivo 2" if the
-- name is taken by another account).
INSERT INTO "Account" ("id", "userId", "type", "name", "currency", "balanceCurrent", "archived", "isDefaultCash", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u."id",
  'cash',
  base.name || CASE
    WHEN EXISTS (SELECT 1 FROM "Account" x WHERE x."userId" = u."id" AND x."name" = base.name) THEN ' 2'
    ELSE ''
  END,
  'MXN',
  0,
  false,
  true,
  now(),
  now()
FROM "User" u
CROSS JOIN LATERAL (SELECT CASE WHEN u."locale" = 'en' THEN 'Cash' ELSE 'Efectivo' END AS name) AS base
WHERE NOT EXISTS (
  SELECT 1 FROM "Account" a WHERE a."userId" = u."id" AND a."isDefaultCash"
);

COMMIT;
