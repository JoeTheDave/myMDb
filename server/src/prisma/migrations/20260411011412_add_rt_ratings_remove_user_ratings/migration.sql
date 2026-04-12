/*
  Warnings:

  - You are about to drop the `Rating` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_mediaId_fkey";

-- DropForeignKey
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_userId_fkey";

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "audienceRating" INTEGER,
ADD COLUMN     "criticRating" INTEGER;

-- DropTable
DROP TABLE "Rating";
