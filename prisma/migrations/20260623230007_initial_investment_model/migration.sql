-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "detectedTables" JSONB,
ADD COLUMN     "errors" JSONB,
ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "warnings" JSONB;

-- CreateTable
CREATE TABLE "ImportedRow" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRowId" TEXT NOT NULL,
    "rawData" JSONB,
    "normalizedData" JSONB,
    "rowHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'imported',
    "warnings" JSONB,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "instrumentType" TEXT,
    "isFci" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "importBatchId" TEXT,
    "importedRowId" TEXT,
    "sourceTable" TEXT,
    "sourceSheet" TEXT,
    "sourceRowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentClassification" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "importedRowId" TEXT,
    "sourceTable" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRowId" TEXT NOT NULL,
    "type" TEXT,
    "sector" TEXT,
    "subsector" TEXT,
    "region" TEXT,
    "expectedValue" DECIMAL(18,6),
    "currentValue" DECIMAL(18,6),
    "amount" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstrumentClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentOperation" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "importedRowId" TEXT,
    "sourceTable" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRowId" TEXT NOT NULL,
    "operationDate" TIMESTAMP(3),
    "currency" TEXT,
    "quantity" DECIMAL(18,6),
    "buyPrice" DECIMAL(18,6),
    "totalCost" DECIMAL(18,6),
    "currentPrice" DECIMAL(18,6),
    "currentValue" DECIMAL(18,6),
    "variationAmount" DECIMAL(18,6),
    "variationPercent" DECIMAL(18,6),
    "monthlyRate" DECIMAL(18,6),
    "annualRate" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentSale" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "importedRowId" TEXT,
    "sourceTable" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRowId" TEXT NOT NULL,
    "buyDate" TIMESTAMP(3),
    "sellDate" TIMESTAMP(3),
    "currency" TEXT,
    "quantity" DECIMAL(18,6),
    "buyPrice" DECIMAL(18,6),
    "sellPrice" DECIMAL(18,6),
    "originalCost" DECIMAL(18,6),
    "sellValue" DECIMAL(18,6),
    "realizedGain" DECIMAL(18,6),
    "variationAmount" DECIMAL(18,6),
    "variationPercent" DECIMAL(18,6),
    "minimumObjective" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentMovement" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "importedRowId" TEXT,
    "sourceTable" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRowId" TEXT NOT NULL,
    "movementDate" TIMESTAMP(3),
    "movementType" TEXT,
    "currency" TEXT,
    "amount" DECIMAL(18,6),
    "affectsPerformance" BOOLEAN NOT NULL DEFAULT false,
    "affectsInvestedCapital" BOOLEAN NOT NULL DEFAULT false,
    "capitalEffect" TEXT DEFAULT 'unknown',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "importedRowId" TEXT,
    "sourceTable" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRowId" TEXT NOT NULL,
    "priceDate" TIMESTAMP(3),
    "month" TEXT,
    "price" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkIndex" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "importedRowId" TEXT,
    "sourceTable" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRowId" TEXT NOT NULL,
    "benchmarkType" TEXT NOT NULL DEFAULT 'unknown',
    "benchmarkDate" TIMESTAMP(3),
    "month" TEXT,
    "tna" DECIMAL(18,6),
    "dailyReturnPercent" DECIMAL(18,6),
    "indexValue" DECIMAL(18,6),
    "inflationMonthlyPercent" DECIMAL(18,6),
    "daysInMonth" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenchmarkIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingOrder" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "importedRowId" TEXT,
    "sourceTable" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRowId" TEXT NOT NULL,
    "currency" TEXT,
    "quantity" DECIMAL(18,6),
    "limitPrice" DECIMAL(18,6),
    "reservedAmount" DECIMAL(18,6),
    "orderStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrentPositionSnapshot" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "importedRowId" TEXT,
    "sourceTable" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRowId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3),
    "currency" TEXT,
    "positionType" TEXT,
    "quantity" DECIMAL(18,6),
    "totalInvested" DECIMAL(18,6),
    "currentPrice" DECIMAL(18,6),
    "currentValue" DECIMAL(18,6),
    "resultAmount" DECIMAL(18,6),
    "resultPercent" DECIMAL(18,6),
    "averagePrice" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrentPositionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportedRow_importBatchId_sourceTable_sourceRowId_idx" ON "ImportedRow"("importBatchId", "sourceTable", "sourceRowId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedRow_importBatchId_sourceTable_sourceRowId_key" ON "ImportedRow"("importBatchId", "sourceTable", "sourceRowId");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_symbol_key" ON "Instrument"("symbol");

-- CreateIndex
CREATE INDEX "Instrument_symbol_idx" ON "Instrument"("symbol");

-- CreateIndex
CREATE INDEX "Instrument_importBatchId_sourceTable_sourceRowId_idx" ON "Instrument"("importBatchId", "sourceTable", "sourceRowId");

-- CreateIndex
CREATE INDEX "InstrumentClassification_instrumentId_idx" ON "InstrumentClassification"("instrumentId");

-- CreateIndex
CREATE INDEX "InstrumentClassification_importBatchId_sourceTable_sourceRo_idx" ON "InstrumentClassification"("importBatchId", "sourceTable", "sourceRowId");

-- CreateIndex
CREATE INDEX "InvestmentOperation_instrumentId_operationDate_idx" ON "InvestmentOperation"("instrumentId", "operationDate");

-- CreateIndex
CREATE INDEX "InvestmentOperation_importBatchId_sourceTable_sourceRowId_idx" ON "InvestmentOperation"("importBatchId", "sourceTable", "sourceRowId");

-- CreateIndex
CREATE INDEX "InvestmentSale_instrumentId_sellDate_idx" ON "InvestmentSale"("instrumentId", "sellDate");

-- CreateIndex
CREATE INDEX "InvestmentSale_importBatchId_sourceTable_sourceRowId_idx" ON "InvestmentSale"("importBatchId", "sourceTable", "sourceRowId");

-- CreateIndex
CREATE INDEX "InvestmentMovement_instrumentId_movementDate_idx" ON "InvestmentMovement"("instrumentId", "movementDate");

-- CreateIndex
CREATE INDEX "InvestmentMovement_importBatchId_sourceTable_sourceRowId_idx" ON "InvestmentMovement"("importBatchId", "sourceTable", "sourceRowId");

-- CreateIndex
CREATE INDEX "PriceHistory_instrumentId_priceDate_idx" ON "PriceHistory"("instrumentId", "priceDate");

-- CreateIndex
CREATE INDEX "PriceHistory_importBatchId_sourceTable_sourceRowId_idx" ON "PriceHistory"("importBatchId", "sourceTable", "sourceRowId");

-- CreateIndex
CREATE INDEX "BenchmarkIndex_benchmarkType_benchmarkDate_idx" ON "BenchmarkIndex"("benchmarkType", "benchmarkDate");

-- CreateIndex
CREATE INDEX "BenchmarkIndex_importBatchId_sourceTable_sourceRowId_idx" ON "BenchmarkIndex"("importBatchId", "sourceTable", "sourceRowId");

-- CreateIndex
CREATE INDEX "PendingOrder_instrumentId_orderStatus_idx" ON "PendingOrder"("instrumentId", "orderStatus");

-- CreateIndex
CREATE INDEX "PendingOrder_importBatchId_sourceTable_sourceRowId_idx" ON "PendingOrder"("importBatchId", "sourceTable", "sourceRowId");

-- CreateIndex
CREATE INDEX "CurrentPositionSnapshot_snapshotDate_instrumentId_idx" ON "CurrentPositionSnapshot"("snapshotDate", "instrumentId");

-- CreateIndex
CREATE INDEX "CurrentPositionSnapshot_importBatchId_sourceTable_sourceRow_idx" ON "CurrentPositionSnapshot"("importBatchId", "sourceTable", "sourceRowId");

-- AddForeignKey
ALTER TABLE "ImportedRow" ADD CONSTRAINT "ImportedRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_importedRowId_fkey" FOREIGN KEY ("importedRowId") REFERENCES "ImportedRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentClassification" ADD CONSTRAINT "InstrumentClassification_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentClassification" ADD CONSTRAINT "InstrumentClassification_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentClassification" ADD CONSTRAINT "InstrumentClassification_importedRowId_fkey" FOREIGN KEY ("importedRowId") REFERENCES "ImportedRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentOperation" ADD CONSTRAINT "InvestmentOperation_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentOperation" ADD CONSTRAINT "InvestmentOperation_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentOperation" ADD CONSTRAINT "InvestmentOperation_importedRowId_fkey" FOREIGN KEY ("importedRowId") REFERENCES "ImportedRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentSale" ADD CONSTRAINT "InvestmentSale_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentSale" ADD CONSTRAINT "InvestmentSale_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentSale" ADD CONSTRAINT "InvestmentSale_importedRowId_fkey" FOREIGN KEY ("importedRowId") REFERENCES "ImportedRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentMovement" ADD CONSTRAINT "InvestmentMovement_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentMovement" ADD CONSTRAINT "InvestmentMovement_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentMovement" ADD CONSTRAINT "InvestmentMovement_importedRowId_fkey" FOREIGN KEY ("importedRowId") REFERENCES "ImportedRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_importedRowId_fkey" FOREIGN KEY ("importedRowId") REFERENCES "ImportedRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkIndex" ADD CONSTRAINT "BenchmarkIndex_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkIndex" ADD CONSTRAINT "BenchmarkIndex_importedRowId_fkey" FOREIGN KEY ("importedRowId") REFERENCES "ImportedRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingOrder" ADD CONSTRAINT "PendingOrder_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingOrder" ADD CONSTRAINT "PendingOrder_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingOrder" ADD CONSTRAINT "PendingOrder_importedRowId_fkey" FOREIGN KEY ("importedRowId") REFERENCES "ImportedRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentPositionSnapshot" ADD CONSTRAINT "CurrentPositionSnapshot_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentPositionSnapshot" ADD CONSTRAINT "CurrentPositionSnapshot_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentPositionSnapshot" ADD CONSTRAINT "CurrentPositionSnapshot_importedRowId_fkey" FOREIGN KEY ("importedRowId") REFERENCES "ImportedRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
