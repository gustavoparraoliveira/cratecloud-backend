-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "url" TEXT,
ALTER COLUMN "filename" DROP NOT NULL;
