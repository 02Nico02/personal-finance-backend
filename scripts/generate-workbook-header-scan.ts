import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { getOfficialSheetNames, getOfficialTablesForSheet } from '../src/imports/excel/excel-workbook-map';
import { getExpectedHeadersForTable, normalizeHeaderText } from '../src/imports/excel/header-range-analysis';

type ScanCandidate = {
  rowNumber: number;
  score: number;
  confidence: 'alta' | 'media' | 'baja' | 'no encontrado';
  headersFound: string[];
  headersMissing: string[];
  matchedFrom: 'values' | 'keys';
  sampleRow: unknown[];
  followingRows: unknown[][];
};

type SheetScanResult = {
  sheet: string;
  table: string;
  candidate: ScanCandidate | null;
};

const outputDir = path.join(process.cwd(), 'docs', 'import-diagnostics');

async function main(): Promise<void> {
  const workbookPathArg = process.argv[2];

  if (!workbookPathArg) {
    throw new Error('Debes pasar la ruta del archivo Excel. Ejemplo: npm run excel:scan-headers -- ./data/Historial Sueldo.xlsm');
  }

  const workbookPath = path.isAbsolute(workbookPathArg) ? workbookPathArg : path.resolve(process.cwd(), workbookPathArg);
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`No se encontro el archivo Excel en: ${workbookPath}`);
  }

  const workbook = xlsx.readFile(workbookPath, { cellDates: true, cellNF: false, cellText: false });
  const scanResults: SheetScanResult[] = [];
  const missingSheets: string[] = [];

  for (const sheetName of getOfficialSheetNames()) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      missingSheets.push(sheetName);
      continue;
    }

    const matrix = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: true
    }) as unknown[][];

    for (const table of getOfficialTablesForSheet(sheetName)) {
      const candidate = findBestCandidate(matrix, table.name);
      scanResults.push({
        sheet: sheetName,
        table: table.name,
        candidate
      });
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `workbook-header-scan-${timestamp}.md`);
  fs.writeFileSync(outputPath, buildMarkdown(workbookPath, scanResults, missingSheets), 'utf8');

  console.log(`Scanner crudo generado en: ${outputPath}`);
}

function findBestCandidate(matrix: unknown[][], tableName: string): ScanCandidate | null {
  const expectedHeaders = getExpectedHeadersForTable(tableName);
  const scored = matrix
    .map((row, index) => scoreRow(matrix, row, expectedHeaders, index + 1))
    .filter((candidate) => candidate.headersFound.length > 0 && candidate.score >= 0.25)
    .sort((a, b) => b.score - a.score || a.rowNumber - b.rowNumber);

  return scored[0] ?? null;
}

function scoreRow(matrix: unknown[][], row: unknown[], expectedHeaders: string[], rowNumber: number): ScanCandidate {
  const normalizedTokens = collectRowTokens(row);
  const matched = expectedHeaders.filter((header) => normalizedTokens.some((token) => token === normalizeHeaderText(header) || token.includes(normalizeHeaderText(header)) || normalizeHeaderText(header).includes(token)));
  const score = expectedHeaders.length ? matched.length / expectedHeaders.length : 0;
  const missing = expectedHeaders.filter((header) => !matched.includes(header));

  return {
    rowNumber,
    score: roundScore(score),
    confidence: score >= 0.7 ? 'alta' : score >= 0.45 ? 'media' : score >= 0.25 ? 'baja' : 'no encontrado',
    headersFound: matched,
    headersMissing: missing,
    matchedFrom: 'values',
    sampleRow: truncateRow(row),
    followingRows: matrix.slice(rowNumber, rowNumber + 3).map((nextRow) => truncateRow(nextRow))
  };
}

function collectRowTokens(row: unknown[]): string[] {
  const tokens = new Set<string>();
  for (const cell of row) {
    collectTokensFromCell(cell).forEach((token) => tokens.add(token));
  }
  return Array.from(tokens);
}

function collectTokensFromCell(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTokensFromCell(item));
  }
  if (value instanceof Date) {
    return [normalizeHeaderText(value.toISOString())];
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((item) => collectTokensFromCell(item));
  }
  return String(value)
    .split(/[\n\r,;|/]+/)
    .map((part) => normalizeHeaderText(part))
    .filter(Boolean);
}

function truncateRow(row: unknown[]): unknown[] {
  return row.slice(0, 20).map((value) => truncateValue(value));
}

function truncateValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => truncateValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 20)
        .map(([key, item]) => [key, truncateValue(item)])
    );
  }
  return value;
}

function buildMarkdown(workbookPath: string, results: SheetScanResult[], missingSheets: string[]): string {
  const summaryRows = results.map((item) => {
    const candidate = item.candidate;
    return `| ${escapeCell(item.sheet)} | ${escapeCell(item.table)} | ${candidate ? candidate.rowNumber : ''} | ${candidate ? candidate.score.toFixed(3) : '0.000'} | ${candidate ? candidate.confidence : 'no encontrado'} | ${candidate ? escapeCell(candidate.headersFound.join(', ')) : ''} |`;
  });

  const detailSections = results
    .map((item) => {
      const candidate = item.candidate;
      return [
        `### ${item.sheet}`,
        '',
        `#### ${item.table}`,
        '',
        `- Mejor fila candidata: ${candidate ? candidate.rowNumber : 'ninguna'}`,
        `- Score: ${candidate ? candidate.score.toFixed(3) : '0.000'}`,
        `- Confianza: ${candidate ? candidate.confidence : 'no encontrado'}`,
        `- Headers encontrados: ${candidate && candidate.headersFound.length ? candidate.headersFound.join(', ') : 'ninguno'}`,
        `- Headers faltantes: ${candidate && candidate.headersMissing.length ? candidate.headersMissing.join(', ') : 'ninguno'}`,
        `- Muestra de fila candidata:`,
        '',
        '```json',
        JSON.stringify(candidate?.sampleRow ?? [], null, 2),
        '```',
        '',
        `- Primeras 3 filas posteriores:`,
        '',
        '```json',
        JSON.stringify(candidate?.followingRows ?? [], null, 2),
        '```'
      ].join('\n');
    })
    .join('\n\n');

  const missingRows = results
    .filter((item) => !item.candidate)
    .map((item) => `| ${escapeCell(item.sheet)} | ${escapeCell(item.table)} | no se encontro una fila candidata con confianza suficiente |`);

  return [
    '# Scanner crudo de cabeceras del workbook',
    '',
    '## Archivo',
    '',
    `- Path: ${workbookPath}`,
    `- Fecha de analisis: ${new Date().toISOString()}`,
    `- Hojas analizadas: ${[...new Set(results.map((item) => item.sheet))].join(', ') || 'ninguna'}`,
    `- Hojas faltantes en el workbook: ${missingSheets.length ? missingSheets.join(', ') : 'ninguna'}`,
    '',
    '## Resumen',
    '',
    '| hoja | tabla esperada | fila candidata | score | confianza | headers encontrados |',
    '|---|---|---:|---:|---|---|',
    ...(summaryRows.length ? summaryRows : ['| ninguna | ninguna | | 0.000 | no encontrado | |']),
    '',
    '## Detalle por hoja',
    '',
    detailSections || '_Sin resultados._',
    '',
    '## Tablas no encontradas',
    '',
    '| hoja | tabla | motivo |',
    '|---|---|---|',
    ...(missingRows.length ? missingRows : ['| ninguna | ninguna | ninguna |'])
  ].join('\n');
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
