-- Denormalised value score (intelligenceIndex / blendedPrice), see docs/03 decision log.
-- NOTE: `prisma migrate diff` also proposes `DROP INDEX "Model_searchKey_trgm_idx"` because Prisma cannot model the
-- hand-written pg_trgm index. That line is deliberately removed: never let a generated migration drop it.

-- AlterTable
ALTER TABLE "Model" ADD COLUMN     "valueScore" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Model_valueScore_idx" ON "Model"("valueScore" DESC);
