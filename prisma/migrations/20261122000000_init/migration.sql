-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'EMBEDDING', 'SPEECH', 'TRANSCRIPTION', 'RERANK', 'REALTIME');

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ModelType" NOT NULL DEFAULT 'TEXT',
    "family" TEXT,
    "releasedAt" DATE,
    "knowledgeCutoff" DATE,
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "inputModalities" TEXT[],
    "outputModalities" TEXT[],
    "reasoning" BOOLEAN NOT NULL DEFAULT false,
    "toolCall" BOOLEAN NOT NULL DEFAULT false,
    "structuredOutput" BOOLEAN NOT NULL DEFAULT false,
    "vision" BOOLEAN NOT NULL DEFAULT false,
    "openWeights" BOOLEAN NOT NULL DEFAULT false,
    "inputPrice" DECIMAL(12,6),
    "outputPrice" DECIMAL(12,6),
    "cacheReadPrice" DECIMAL(12,6),
    "cacheWritePrice" DECIMAL(12,6),
    "blendedPrice" DECIMAL(12,6),
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "providerCount" INTEGER NOT NULL DEFAULT 0,
    "intelligenceIndex" DOUBLE PRECISION,
    "openrouterId" TEXT,
    "searchKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiUrl" TEXT,
    "docUrl" TEXT,
    "labId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "providerModelId" TEXT NOT NULL,
    "contextWindow" INTEGER,
    "inputLimit" INTEGER,
    "maxOutputTokens" INTEGER,
    "inputPrice" DECIMAL(12,6),
    "outputPrice" DECIMAL(12,6),
    "reasoningPrice" DECIMAL(12,6),
    "cacheReadPrice" DECIMAL(12,6),
    "cacheWritePrice" DECIMAL(12,6),
    "reasoning" BOOLEAN,
    "toolCall" BOOLEAN,
    "structuredOutput" BOOLEAN,
    "temperature" BOOLEAN,
    "status" TEXT,
    "sourceUpdatedAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benchmark" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
    "sourceUrl" TEXT,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkScore" (
    "modelId" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "winRate" DOUBLE PRECISION,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "BenchmarkScore_pkey" PRIMARY KEY ("modelId","benchmarkId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lab_slug_key" ON "Lab"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Model_openrouterId_key" ON "Model"("openrouterId");

-- CreateIndex
CREATE INDEX "Model_type_idx" ON "Model"("type");

-- CreateIndex
CREATE INDEX "Model_labId_idx" ON "Model"("labId");

-- CreateIndex
CREATE INDEX "Model_releasedAt_idx" ON "Model"("releasedAt" DESC);

-- CreateIndex
CREATE INDEX "Model_blendedPrice_idx" ON "Model"("blendedPrice");

-- CreateIndex
CREATE INDEX "Model_contextWindow_idx" ON "Model"("contextWindow");

-- CreateIndex
CREATE INDEX "Model_providerCount_idx" ON "Model"("providerCount" DESC);

-- CreateIndex
CREATE INDEX "Model_intelligenceIndex_idx" ON "Model"("intelligenceIndex" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Model_labId_slug_key" ON "Model"("labId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE INDEX "ProviderModel_modelId_idx" ON "ProviderModel"("modelId");

-- CreateIndex
CREATE INDEX "ProviderModel_providerId_idx" ON "ProviderModel"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderModel_providerId_providerModelId_key" ON "ProviderModel"("providerId", "providerModelId");

-- CreateIndex
CREATE UNIQUE INDEX "Benchmark_key_key" ON "Benchmark"("key");

-- CreateIndex
CREATE INDEX "BenchmarkScore_benchmarkId_rank_idx" ON "BenchmarkScore"("benchmarkId", "rank");

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderModel" ADD CONSTRAINT "ProviderModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderModel" ADD CONSTRAINT "ProviderModel_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkScore" ADD CONSTRAINT "BenchmarkScore_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkScore" ADD CONSTRAINT "BenchmarkScore_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Search: trigram GIN index so ILIKE '%q%' on Model.searchKey is index-assisted.
-- Hand-added: Prisma cannot declare gin_trgm_ops. Do not drop when regenerating migrations.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Model_searchKey_trgm_idx" ON "Model" USING GIN ("searchKey" gin_trgm_ops);
