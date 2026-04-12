-- CreateEnum
CREATE TYPE "CastSortOrder" AS ENUM ('BY_ACTOR', 'BY_ROLE', 'CUSTOM');

-- AlterTable
ALTER TABLE "CastRole" ADD COLUMN     "billingOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "castSortOrder" "CastSortOrder" NOT NULL DEFAULT 'BY_ACTOR';

-- Set initial billingOrder based on createdAt within each media
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "mediaId" ORDER BY "createdAt" ASC) - 1 AS rn
  FROM "CastRole"
)
UPDATE "CastRole"
SET "billingOrder" = ranked.rn
FROM ranked
WHERE "CastRole".id = ranked.id;
