-- Fold the retired tiers into their replacements before the enum shrinks.
-- Staging DB checked 2026-09-26: 1 DIRECTOR, 5 SELLER, 0 SUPER_ADMIN/MANAGER/VIEWER —
-- these UPDATEs are a no-op there, but must still run for any environment that
-- has rows in the retired values (e.g. production, not yet migrated).
UPDATE "User" SET "role" = 'DIRECTOR' WHERE "role" IN ('SUPER_ADMIN', 'MANAGER');
UPDATE "User" SET "role" = 'SELLER' WHERE "role" = 'VIEWER';

-- Postgres enums can't drop values in place; rebuild the type.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('DIRECTOR', 'SELLER');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_old";
