/*
  Warnings:

  - Made the column `url` on table `Track` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Track" ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "url" SET NOT NULL;
