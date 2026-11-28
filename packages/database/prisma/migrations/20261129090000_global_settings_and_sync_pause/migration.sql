BEGIN;

-- Platform-wide settings ("Configuración global"): a single row.
CREATE TABLE "GlobalSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "bankSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GlobalSettings_single_row" CHECK ("id" = 1)
);

ALTER TABLE "GlobalSettings" ADD CONSTRAINT "GlobalSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "GlobalSettings" ("id", "bankSyncEnabled", "updatedAt") VALUES (1, true, now());

-- A user can pause the sync of one of their bank connections.
ALTER TABLE "BankConnection" ADD COLUMN "syncPausedAt" TIMESTAMP(3);

COMMIT;
