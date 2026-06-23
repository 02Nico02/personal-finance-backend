export interface ImportExcelSheetSummaryDto {
  name: string;
  sourceTables: string[];
  rowsImported: number;
}

export interface ImportExcelResponseDto {
  importBatchId: string;
  fileName: string;
  status: string;
  checksum: string;
  detectedTables: string[];
  sheets: ImportExcelSheetSummaryDto[];
  rowsImported: number;
  warnings: string[];
}
