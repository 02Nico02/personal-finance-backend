import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../database/prisma.service';
import { ExcelWorkbookReaderService, ImportedWorkbookRow } from './excel-workbook-reader.service';
import { ImportExcelResponseDto } from './dto/import-excel-response.dto';

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xlsm', '.xls']);
const DEFAULT_CHUNK_SIZE = 500;
const TRANSACTION_TIMEOUT_MS = 120_000;
const TRANSACTION_MAX_WAIT_MS = 10_000;

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workbookReader: ExcelWorkbookReaderService
  ) {}

  assertAllowedExtension(fileName: string): void {
    const extension = extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Extensión de archivo no permitida. Usa .xlsx, .xlsm o .xls.');
    }
  }

  calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async importExcel(file: Express.Multer.File): Promise<ImportExcelResponseDto> {
    if (!file) {
      throw new BadRequestException('Debes enviar un archivo Excel en el campo file.');
    }

    this.assertAllowedExtension(file.originalname);
    const checksum = this.calculateChecksum(file.buffer);
    const fileName = file.originalname.split(/[\\/]/).pop() ?? file.originalname;

    const prismaAny = this.prisma as any;

    const importBatch = await prismaAny.importBatch.create({
      data: {
        fileName,
        originalFileName: file.originalname,
        checksum,
        status: 'processing',
        detectedTables: [],
        warnings: [],
        errors: []
      }
    });

    try {
      const document = this.workbookReader.read(file.buffer);
      const allRows = document.sheets.flatMap((sheet) => sheet.rows);

      const rowChunks = this.chunk(allRows, DEFAULT_CHUNK_SIZE);

      await this.prisma.$transaction(async (tx) => {
        const txAny = tx as any;
        for (const chunk of rowChunks) {
          await txAny.importedRow.createMany({
            data: chunk.map((row) => this.mapRow(importBatch.id, row))
          });
        }

        await txAny.importBatch.update({
          where: { id: importBatch.id },
          data: {
            status: 'imported',
            detectedTables: document.detectedTables,
            warnings: document.warnings,
            errors: []
          }
        });
      }, {
        maxWait: TRANSACTION_MAX_WAIT_MS,
        timeout: TRANSACTION_TIMEOUT_MS
      });

      return {
        importBatchId: importBatch.id,
        fileName,
        status: 'imported',
        checksum,
        detectedTables: document.detectedTables,
        sheets: document.sheets.map((sheet) => ({
          name: sheet.name,
          sourceTables: sheet.sourceTables,
          rowsImported: sheet.rows.length
        })),
        rowsImported: allRows.length,
        warnings: document.warnings
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al procesar el Excel.';
      await this.markImportBatchFailed(importBatch.id, errorMessage);
      throw new InternalServerErrorException({
        message: 'No se pudo procesar el archivo Excel.',
        importBatchId: importBatch.id,
        error: errorMessage
      });
    }
  }

  private async markImportBatchFailed(importBatchId: string, errorMessage: string): Promise<void> {
    try {
      const prismaAny = this.prisma as any;
      await prismaAny.importBatch.update({
        where: { id: importBatchId },
        data: {
          status: 'failed',
          errors: [errorMessage]
        }
      });
    } catch {
      // Best effort only.
    }
  }

  private mapRow(importBatchId: string, row: ImportedWorkbookRow): Record<string, unknown> {
    return {
      importBatchId,
      sourceTable: row.sourceTable,
      sourceSheet: row.sourceSheet,
      sourceRowId: row.sourceRowId,
      rawData: row.rawData as Prisma.InputJsonValue,
      normalizedData: row.normalizedData as Prisma.InputJsonValue,
      rowHash: row.rowHash,
      status: 'imported',
      warnings: [],
      errors: []
    };
  }

  private chunk<T>(values: T[], size: number): T[][] {
    if (size <= 0) {
      return [values];
    }
    const chunks: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
      chunks.push(values.slice(index, index + size));
    }
    return chunks;
  }
}
