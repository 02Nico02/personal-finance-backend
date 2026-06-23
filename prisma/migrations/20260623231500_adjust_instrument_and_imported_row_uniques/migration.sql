-- DropIndex
DROP INDEX "ImportedRow_importBatchId_sourceTable_sourceRowId_idx";

-- DropIndex
DROP INDEX "ImportedRow_importBatchId_sourceTable_sourceRowId_key";

-- DropIndex
DROP INDEX "Instrument_symbol_key";

-- AlterTable
ALTER TABLE "ImportedRow" ALTER COLUMN "sourceSheet" SET NOT NULL,
ALTER COLUMN "sourceSheet" SET DEFAULT 'workbook';

-- AlterTable
ALTER TABLE "Instrument" ALTER COLUMN "currency" SET NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'UNKNOWN',
ALTER COLUMN "instrumentType" SET NOT NULL,
ALTER COLUMN "instrumentType" SET DEFAULT 'UNKNOWN';

-- CreateIndex
CREATE INDEX "ImportedRow_importBatchId_sourceTable_sourceSheet_sourceRow_idx" ON "ImportedRow"("importBatchId", "sourceTable", "sourceSheet", "sourceRowId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedRow_importBatchId_sourceTable_sourceSheet_sourceRow_key" ON "ImportedRow"("importBatchId", "sourceTable", "sourceSheet", "sourceRowId");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_symbol_currency_instrumentType_key" ON "Instrument"("symbol", "currency", "instrumentType");
