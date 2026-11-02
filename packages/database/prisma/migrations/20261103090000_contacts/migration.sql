-- Contacts (people the user deals with; only the name for now) and the
-- lender contact of personal loans. Existing personal loans with a lender
-- name get a contact. Additive.
-- Rollback: ../../../scripts/rollbacks/20261103090000_contacts.sql
BEGIN;

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");
CREATE UNIQUE INDEX "Contact_userId_name_key" ON "Contact"("userId", "name");
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Debt" ADD COLUMN "lenderContactId" TEXT;
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_lenderContactId_fkey" FOREIGN KEY ("lenderContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: a contact for every lender of a personal loan.
INSERT INTO "Contact" ("id", "userId", "name")
SELECT gen_random_uuid()::text, d."userId", btrim(d."lenderName")
FROM "Debt" d
WHERE d."loanType" = 'personal'
  AND btrim(coalesce(d."lenderName", '')) <> ''
GROUP BY d."userId", btrim(d."lenderName")
ON CONFLICT ("userId", "name") DO NOTHING;

UPDATE "Debt" d
SET "lenderContactId" = c."id"
FROM "Contact" c
WHERE d."loanType" = 'personal'
  AND c."userId" = d."userId"
  AND c."name" = btrim(d."lenderName");

COMMIT;
