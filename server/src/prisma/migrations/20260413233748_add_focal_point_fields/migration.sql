-- AlterTable
ALTER TABLE "Actor" ADD COLUMN     "imageFocalX" DOUBLE PRECISION,
ADD COLUMN     "imageFocalY" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CastRole" ADD COLUMN     "roleImageFocalX" DOUBLE PRECISION,
ADD COLUMN     "roleImageFocalY" DOUBLE PRECISION;
