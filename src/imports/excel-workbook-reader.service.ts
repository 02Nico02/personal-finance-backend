import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import * as XLSX from 'xlsx';

export interface ImportedWorkbookRow {
  sourceSheet: string;
  sourceTable: string;
  sourceRowId: string;
  rawData: Record<string, unknown>;
  normalizedData: Record<string, unknown>;
  rowHash: string;
}

export interface ImportedWorkbookSheet {
  name: string;
  sourceTables: string[];
  rows: ImportedWorkbookRow[];
}

export interface ImportedWorkbookDocument {
  sheetNames: string[];
  detectedTables: string[];
  sheets: ImportedWorkbookSheet[];
  warnings: string[];
}

type TableHeuristic = {
  name: string;
  requiredHeaders: string[];
};

const KNOWN_TABLES: TableHeuristic[] = [
  { name: 'Tabla6', requiredHeaders: ['ESPECIE', 'TOTAL', 'PREC. COMP.'] },
  { name: 'Tabla13', requiredHeaders: ['ESPECIE', 'Fecha Vent.', 'VALORI. ACT.'] },
  { name: 'TablaPosiciones', requiredHeaders: ['ESPECIE', 'TOTAL ACTUAL', 'RESULTADO %'] },
  { name: 'Tabla5', requiredHeaders: ['ESPECIE', 'PRECIO'] },
  { name: 'Tabla47', requiredHeaders: ['ESPECIE', 'SECTOR', 'REGION'] },
  { name: 'Tabla11', requiredHeaders: ['Fondos com. Inv.'] },
  { name: 'Tabla14', requiredHeaders: ['FECHA', 'BALANCE'] },
  { name: 'Tabla35', requiredHeaders: ['FECHA', '% JUBILACIÓN', '% AHORRO'] },
  { name: 'TablaMovimientosInversiones', requiredHeaders: ['Fecha', 'Especie', 'Tipo movimiento'] },
  { name: 'Tabla_OrdenesPendientes', requiredHeaders: ['ESPECIE', 'Cant', 'PRECIO'] },
  { name: 'TablaCalendario', requiredHeaders: ['Fecha', 'TNA', 'Rend_diaria', 'Indice'] },
  { name: 'TablaCalendarioRem', requiredHeaders: ['Fecha', 'TNA', 'Rend_diaria', 'Indice'] },
  { name: 'TablaCalendarioInf', requiredHeaders: ['Fecha', 'Mes', 'Rend_diaria_inf', 'Indice_inf'] }
];

@Injectable()
export class ExcelWorkbookReaderService {
  read(buffer: Buffer): ImportedWorkbookDocument {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellText: false
    });

    const sheetNames = workbook.SheetNames ?? [];
    const warnings: string[] = [];
    const sheets: ImportedWorkbookSheet[] = [];
    const detectedTables = new Set<string>();

    sheetNames.forEach((sheetName, sheetIndex) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        warnings.push(`No se pudo leer la hoja ${sheetName}.`);
        return;
      }

      const rowsMatrix = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        blankrows: true,
        defval: null,
        raw: true
      }) as unknown[][];

      const sourceSheets = this.extractSheetsFromMatrix(sheetName, sheetIndex + 1, rowsMatrix);
      for (const sheet of sourceSheets) {
        sheet.sourceTables.forEach((tableName) => detectedTables.add(tableName));
        sheets.push(sheet);
      }
    });

    return {
      sheetNames,
      detectedTables: Array.from(detectedTables),
      sheets,
      warnings
    };
  }

  private extractSheetsFromMatrix(sheetName: string, sheetIndex: number, rowsMatrix: unknown[][]): ImportedWorkbookSheet[] {
    const blocks: ImportedWorkbookSheet[] = [];
    let currentBlock: unknown[][] = [];

    const pushCurrentBlock = (blockIndex: number): void => {
      if (!currentBlock.length) {
        return;
      }
      const parsed = this.parseBlock(sheetName, sheetIndex, blockIndex, currentBlock);
      if (parsed.rows.length) {
        blocks.push(parsed);
      }
      currentBlock = [];
    };

    let blockIndex = 0;
    for (const row of rowsMatrix) {
      if (this.isEmptyRow(row)) {
        pushCurrentBlock(blockIndex);
        if (currentBlock.length === 0) {
          blockIndex += 1;
        }
        continue;
      }
      currentBlock.push(row);
    }

    pushCurrentBlock(blockIndex);
    return blocks;
  }

  private parseBlock(sheetName: string, sheetIndex: number, blockIndex: number, blockRows: unknown[][]): ImportedWorkbookSheet {
    const headerRow = blockRows[0] ?? [];
    const headers = this.buildHeaders(headerRow);
    const sourceTable = this.detectTableName(sheetName, headers) ?? `${sheetName}#${blockIndex + 1}`;
    const rows = blockRows.slice(1).map((row, rowOffset) => {
      const rawData = this.rowToObject(headers, row);
      const normalizedData = rawData;
      const sourceRowNumber = rowOffset + 2;
      const sourceRowId = `${sourceRowNumber}`;
      return {
        sourceSheet: sheetName,
        sourceTable,
        sourceRowId,
        rawData,
        normalizedData,
        rowHash: this.hashRow({
          sheetName,
          sheetIndex,
          sourceTable,
          sourceRowId,
          rawData
        })
      };
    });

    return {
      name: sheetName,
      sourceTables: [sourceTable],
      rows
    };
  }

  private buildHeaders(headerRow: unknown[]): string[] {
    const headers: string[] = [];
    const used = new Map<string, number>();

    headerRow.forEach((cell, index) => {
      const base = this.asHeader(cell) || `col_${index + 1}`;
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      headers.push(count === 1 ? base : `${base}_${count}`);
    });

    return headers;
  }

  private detectTableName(sheetName: string, headers: string[]): string | null {
    const normalizedSheetName = this.normalize(sheetName);
    const normalizedHeaders = headers.map((header) => this.normalize(header));

    const exactMatch = KNOWN_TABLES.find((table) => this.normalize(table.name) === normalizedSheetName);
    if (exactMatch) {
      return exactMatch.name;
    }

    const bestMatch = KNOWN_TABLES.find((table) =>
      table.requiredHeaders.every((requiredHeader) => normalizedHeaders.includes(this.normalize(requiredHeader)))
    );

    return bestMatch?.name ?? null;
  }

  private rowToObject(headers: string[], row: unknown[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      result[header] = this.toJsonCompatible(row[index]);
    });
    return result;
  }

  private isEmptyRow(row: unknown[]): boolean {
    return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '');
  }

  private asHeader(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();
  }

  private hashRow(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private toJsonCompatible(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.toJsonCompatible(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, this.toJsonCompatible(item)])
      );
    }
    return value ?? null;
  }
}
