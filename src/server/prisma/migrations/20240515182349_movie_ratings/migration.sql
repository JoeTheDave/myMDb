/*
  Warnings:

  - Added the required column `role` to the `AppUser` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "role" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "AppUserMovieRating" (
    "appUserId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUserMovieRating_pkey" PRIMARY KEY ("appUserId","movieId")
);

-- AddForeignKey
ALTER TABLE "AppUserMovieRating" ADD CONSTRAINT "AppUserMovieRating_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUserMovieRating" ADD CONSTRAINT "AppUserMovieRating_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
