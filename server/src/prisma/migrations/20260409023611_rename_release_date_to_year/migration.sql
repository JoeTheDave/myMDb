/*
  Warnings:

  - You are about to drop the column `releaseDate` on the `Media` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Media" DROP COLUMN "releaseDate",
ADD COLUMN     "releaseYear" INTEGER;
