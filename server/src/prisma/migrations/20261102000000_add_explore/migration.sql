-- AlterTable
ALTER TABLE "Media" ADD COLUMN "tmdbId" INTEGER;

-- AlterTable
ALTER TABLE "Actor" ADD COLUMN "tmdbPersonId" INTEGER;

-- CreateTable
CREATE TABLE "ExploreDismissal" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExploreDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExploreDismissal_tmdbId_mediaType_key" ON "ExploreDismissal"("tmdbId", "mediaType");
