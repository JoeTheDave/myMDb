-- AlterTable
ALTER TABLE "Actor" ADD COLUMN     "actorImage" TEXT;

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "movieImage" TEXT,
ADD COLUMN     "mpaRating" TEXT;

-- AlterTable
ALTER TABLE "MovieActor" ADD COLUMN     "characterImage" TEXT;
