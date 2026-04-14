-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "actorAutoImportDisabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "amazonAutoFetchDisabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imdbId" TEXT,
ADD COLUMN     "rtAutoFetchDisabled" BOOLEAN NOT NULL DEFAULT false;
