import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { getExpectedHeadersForTable } from './header-range-analysis';
import { getOfficialSheetNames, getOfficialTablesForSheet } from './excel-workbook-map';

export type WorkbookHeaderConfidence = 'alta' | 'media' | 'baja' | 'no encontrado';

export type WorkbookHeaderMatch = {
  header: string;
  columns: number[];
};

export type WorkbookHeaderCandidate = {
  sheet: string;
  table: string;
  rowNumber: number;
  score: number;
  confidence: WorkbookHeaderConfidence;
  headersFound: string[];
  headersMissing: string[];
  columnsDetected: number[];
  nonEmptyCells: number;
  sampleRow: unknown[];
  followingRows: unknown[][];
  rowTokens: string[];
  conflictTables: string[];
};

export type WorkbookTableScan = {
  sheet: string;
  table: string;
  expectedHeaders: string[];
  candidates: WorkbookHeaderCandidate[];
  bestCandidate: WorkbookHeaderCandidate | null;
  status: 'found' | 'partial' | 'missing';
};

export type WorkbookConflict = {
  sheet: string;
  rowNumber: number;
  tables: string[];
  comment: string;
};

export type WorkbookScanAnalysis = {
  workbookPath: string;
  workbookSheets: string[];
  officialSheets: string[];
  ignoredSheets: string[];
  tableScans: WorkbookTableScan[];
  conflicts: WorkbookConflict[];
};

export function analyzeWorkbookFile(workbookPathArg: string): WorkbookScanAnalysis {
  const workbookPath = path.isAbsolute(workbookPathArg) ? workbookPathArg : path.resolve(process.cwd(), workbookPathArg);
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`No se encontro el archivo Excel en: ${workbookPath}`);
  }

  const workbook = xlsx.readFile(workbookPath, { cellDates: true, cellNF: false, cellText: false });
  const workbookSheets = workbook.SheetNames;
  const officialSheets = getOfficialSheetNames();
  const ignoredSheets = workbookSheets.filter((sheet) => !officialSheets.includes(sheet));

  const tableScans: WorkbookTableScan[] = [];
  const allCandidates: WorkbookHeaderCandidate[] = [];

  for (const sheet of officialSheets) {
    const worksheet = workbook.Sheets[sheet];
    if (!worksheet) {
      for (const table of getOfficialTablesForSheet(sheet)) {
        tableScans.push({
          sheet,
          table: table.name,
          expectedHeaders: getExpectedHeadersForTable(table.name),
          candidates: [],
          bestCandidate: null,
          status: 'missing'
        });
      }
      continue;
    }

    const matrix = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: true
    }) as unknown[][];

    const sheetCandidates = findSheetCandidates(sheet, matrix);
    allCandidates.push(...sheetCandidates);
    const candidatesByTable = groupCandidatesByTable(sheetCandidates);

    for (const table of getOfficialTablesForSheet(sheet)) {
      const candidates = candidatesByTable.get(table.name) ?? [];
      const bestCandidate = candidates[0] ?? null;
      tableScans.push({
        sheet,
        table: table.name,
        expectedHeaders: getExpectedHeadersForTable(table.name),
        candidates,
        bestCandidate,
        status: bestCandidate ? (bestCandidate.confidence === 'alta' ? 'found' : 'partial') : 'missing'
      });
    }
  }

  const conflicts = buildConflicts(allCandidates);
  return {
    workbookPath,
    workbookSheets,
    officialSheets,
    ignoredSheets,
    tableScans,
    conflicts
  };
}

export function findSheetCandidates(sheet: string, matrix: unknown[][]): WorkbookHeaderCandidate[] {
  const candidates: WorkbookHeaderCandidate[] = [];

  for (let index = 0; index < matrix.length; index += 1) {
    const rowNumber = index + 1;
    const row = matrix[index];
    const rowTokens = collectRowTokens(row);
    const nonEmptyCells = row.filter((cell) => !isEmptyCell(cell)).length;

    for (const table of getOfficialTablesForSheet(sheet)) {
      const candidate = scoreWorkbookRow(sheet, table.name, row, rowTokens, rowNumber, nonEmptyCells, matrix);
      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

export function scoreWorkbookRow(
  sheet: string,
  table: string,
  row: unknown[],
  rowTokens: string[],
  rowNumber: number,
  nonEmptyCells: number,
  matrix: unknown[][]
): WorkbookHeaderCandidate | null {
  const expectedHeaders = getExpectedHeadersForTable(table);
  const matches = expectedHeaders.map((header) => ({
    header,
    columns: findMatchedColumns(row, header)
  }));

  const headersFound = matches.filter((item) => item.columns.length > 0);
  const minimumMatches = expectedHeaders.length === 1 ? 1 : 2;
  if (headersFound.length < minimumMatches) {
    return null;
  }

  const foundHeaders = headersFound.map((item) => item.header);
  const headersMissing = expectedHeaders.filter((header) => !foundHeaders.includes(header));
  const score = expectedHeaders.length ? foundHeaders.length / expectedHeaders.length : 0;
  const confidence = score >= 0.7 ? 'alta' : score >= 0.45 ? 'media' : score >= 0.25 ? 'baja' : 'no encontrado';
  if (confidence === 'no encontrado') {
    return null;
  }

  const columnsDetected = Array.from(new Set(headersFound.flatMap((item) => item.columns)));
  const followingRows = matrix.slice(rowNumber, rowNumber + 3).map((nextRow) => truncateRow(nextRow));

  return {
    sheet,
    table,
    rowNumber,
    score: roundScore(score),
    confidence,
    headersFound: foundHeaders,
    headersMissing,
    columnsDetected,
    nonEmptyCells,
    sampleRow: truncateRow(row),
    followingRows,
    rowTokens,
    conflictTables: []
  };
}

export function groupCandidatesByTable(candidates: WorkbookHeaderCandidate[]): Map<string, WorkbookHeaderCandidate[]> {
  const groups = new Map<string, WorkbookHeaderCandidate[]>();
  for (const candidate of candidates) {
    const list = groups.get(candidate.table) ?? [];
    list.push(candidate);
    groups.set(candidate.table, list);
  }

  for (const [table, list] of groups.entries()) {
    list.sort((a, b) => b.score - a.score || a.rowNumber - b.rowNumber);
    groups.set(table, list.slice(0, 5));
  }

  return groups;
}

export function buildConflicts(candidates: WorkbookHeaderCandidate[]): WorkbookConflict[] {
  const grouped = new Map<string, WorkbookHeaderCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.sheet}:${candidate.rowNumber}`;
    const list = grouped.get(key) ?? [];
    list.push(candidate);
    grouped.set(key, list);
  }

  const conflicts: WorkbookConflict[] = [];
  for (const [key, list] of grouped.entries()) {
    if (list.length < 2) {
      continue;
    }
    const [sheet, rowNumberRaw] = key.split(':');
    conflicts.push({
      sheet,
      rowNumber: Number.parseInt(rowNumberRaw, 10),
      tables: list.map((candidate) => candidate.table),
      comment: 'Requiere revision manual.'
    });
  }
  return conflicts;
}

export function buildWorkbookScanMarkdown(analysis: WorkbookScanAnalysis): string {
  const tableSummaryRows = analysis.tableScans.map((scan) => {
    const candidate = scan.bestCandidate;
    return `| ${escapeCell(scan.sheet)} | ${escapeCell(scan.table)} | ${candidate ? candidate.rowNumber : ''} | ${candidate ? candidate.score.toFixed(3) : '0.000'} | ${candidate ? candidate.confidence : 'no encontrado'} | ${candidate ? escapeCell(candidate.headersFound.join(', ')) : ''} | ${statusLabel(scan.status)} |`;
  });

  const sheetBlocks = analysis.officialSheets
    .map((sheet) => {
      const scans = analysis.tableScans.filter((scan) => scan.sheet === sheet);
      const rows = scans.map((scan) => {
        const candidate = scan.bestCandidate;
        return `| ${candidate ? candidate.rowNumber : ''} | ${escapeCell(scan.table)} | ${candidate ? candidate.score.toFixed(3) : '0.000'} | ${candidate ? candidate.confidence : 'no encontrado'} | ${candidate ? candidate.columnsDetected.join(', ') : ''} | ${candidate ? escapeCell(candidate.headersFound.join(', ')) : ''} |`;
      });

      return [
        `### Hoja: ${sheet}`,
        '',
        '| fila | tabla sugerida | score | confianza | columnas detectadas | headers encontrados |',
        '|---:|---|---:|---|---|---|',
        ...(rows.length ? rows : ['| | ninguna | 0.000 | no encontrado | | |'])
      ].join('\n');
    })
    .join('\n\n');

  const detailSections = analysis.tableScans
    .filter((scan) => scan.bestCandidate)
    .map((scan) => {
      const candidate = scan.bestCandidate!;
      return [
        `### ${scan.sheet} / ${scan.table}`,
        '',
        `- Mejor fila candidata: ${candidate.rowNumber}`,
        `- Score: ${candidate.score.toFixed(3)}`,
        `- Confianza: ${candidate.confidence}`,
        `- Headers encontrados: ${candidate.headersFound.join(', ') || 'ninguno'}`,
        `- Headers faltantes: ${candidate.headersMissing.join(', ') || 'ninguno'}`,
        `- Columnas donde aparecen: ${candidate.columnsDetected.join(', ') || 'ninguna'}`,
        `- Rango probable: ${candidate.rowNumber} - ${findProbableEndRow(analysis.tableScans, scan.sheet, candidate.rowNumber) ?? 'final del bloque'}`,
        `- Conflictos: ${findConflictComment(analysis.conflicts, scan.sheet, candidate.rowNumber)}`,
        '',
        '#### Fila candidata cruda',
        '',
        '```json',
        JSON.stringify(candidate.sampleRow, null, 2),
        '```',
        '',
        '#### Primeras 3 filas posteriores',
        '',
        '```json',
        JSON.stringify(candidate.followingRows.slice(0, 3), null, 2),
        '```'
      ].join('\n');
    })
    .join('\n\n');

  const conflictRows = analysis.conflicts.map((conflict) => `| ${escapeCell(conflict.sheet)} | ${conflict.rowNumber} | ${escapeCell(conflict.tables.join(', '))} | ${escapeCell(conflict.comment)} |`);
  const missingRows = analysis.tableScans
    .filter((scan) => !scan.bestCandidate)
    .map((scan) => `| ${escapeCell(scan.sheet)} | ${escapeCell(scan.table)} | no se encontro una fila candidata con confianza suficiente |`);

  return [
    '# Scanner crudo de cabeceras del workbook',
    '',
    '## Archivo',
    '',
    `- Path: ${analysis.workbookPath}`,
    `- Fecha de analisis: ${new Date().toISOString()}`,
    `- Hojas del workbook: ${analysis.workbookSheets.join(', ') || 'ninguna'}`,
    `- Hojas oficiales analizadas: ${analysis.officialSheets.join(', ') || 'ninguna'}`,
    `- Hojas fuera del mapa: ${analysis.ignoredSheets.join(', ') || 'ninguna'}`,
    '',
    '## Resumen ejecutivo',
    '',
    `- Total de candidatos: ${analysis.tableScans.filter((scan) => scan.bestCandidate).length}`,
    `- Candidatos alta: ${analysis.tableScans.filter((scan) => scan.bestCandidate?.confidence === 'alta').length}`,
    `- Candidatos media: ${analysis.tableScans.filter((scan) => scan.bestCandidate?.confidence === 'media').length}`,
    `- Candidatos baja: ${analysis.tableScans.filter((scan) => scan.bestCandidate?.confidence === 'baja').length}`,
    `- Tablas no encontradas: ${missingRows.length}`,
    `- Conflictos detectados: ${analysis.conflicts.length}`,
    '',
    '## Resumen por hoja y tabla',
    '',
    '| hoja | tabla esperada | mejor fila candidata | score | confianza | headers encontrados | estado |',
    '|---|---|---:|---:|---|---|---|',
    ...(tableSummaryRows.length ? tableSummaryRows : ['| ninguna | ninguna | | 0.000 | no encontrado | | missing |']),
    '',
    '## Candidatos por hoja',
    '',
    sheetBlocks || '_Sin resultados._',
    '',
    '## Detalle por tabla',
    '',
    detailSections || '_Sin candidatos encontrados._',
    '',
    '## Conflictos',
    '',
    '| hoja | fila | tablas candidatas | comentario |',
    '| ---- | ---: | ----------------- | ---------- |',
    ...(conflictRows.length ? conflictRows : ['| ninguna | | | ningun conflicto detectado |']),
    '',
    '## Tablas no encontradas',
    '',
    '| hoja | tabla | motivo |',
    '| ---- | ----- | ------ |',
    ...(missingRows.length ? missingRows : ['| ninguna | ninguna | ninguna |']),
    '',
    '## Recomendacion',
    '',
    buildRecommendationText(analysis),
    ''
  ].join('\n');
}

export function buildRecommendationText(analysis: WorkbookScanAnalysis): string {
  const highConfidence = analysis.tableScans
    .filter((scan) => scan.bestCandidate && scan.bestCandidate.confidence === 'alta')
    .map((scan) => `${scan.sheet}/${scan.table}`);
  const manualReview = analysis.tableScans
    .filter((scan) => scan.bestCandidate && scan.bestCandidate.confidence !== 'alta')
    .map((scan) => `${scan.sheet}/${scan.table}`);
  const missing = analysis.tableScans.filter((scan) => !scan.bestCandidate).map((scan) => `${scan.sheet}/${scan.table}`);

  return [
    `Tablas con cabecera detectada en alta confianza: ${highConfidence.join(', ') || 'ninguna'}.`,
    `Tablas que requieren revision manual: ${manualReview.join(', ') || 'ninguna'}.`,
    `Tablas no encontradas: ${missing.join(', ') || 'ninguna'}.`,
    'Orden sugerido para normalizar: Tabla47 -> Tabla5 -> Tabla11 -> TablaPosiciones -> Tabla_OrdenesPendientes -> TablaCalendario -> TablaCalendarioRem -> TablaCalendarioInf -> Tabla6 -> Tabla13 -> TablaMovimientosInversiones -> Tabla9 -> Tabla14 -> Tabla60 -> HistorialMensualReconstruido -> Tabla35 -> Tabla38 -> Tabla39.'
  ].join(' ');
}

function findProbableEndRow(tableScans: WorkbookTableScan[], sheet: string, rowNumber: number): number | null {
  const nextCandidates = tableScans
    .filter((scan) => scan.sheet === sheet && scan.bestCandidate && scan.bestCandidate.rowNumber > rowNumber)
    .map((scan) => scan.bestCandidate!.rowNumber)
    .sort((a, b) => a - b);

  return nextCandidates.length ? nextCandidates[0] - 1 : null;
}

function findConflictComment(conflicts: WorkbookConflict[], sheet: string, rowNumber: number): string {
  const conflict = conflicts.find((item) => item.sheet === sheet && item.rowNumber === rowNumber);
  return conflict ? conflict.comment : 'sin conflicto';
}

function collectRowTokens(row: unknown[]): string[] {
  const tokens = new Set<string>();
  for (const cell of row) {
    collectTokensFromCell(cell).forEach((token) => tokens.add(token));
  }
  return Array.from(tokens);
}

function findMatchedColumns(row: unknown[], header: string): number[] {
  const normalizedHeader = normalizeWorkbookText(header);
  const columns: number[] = [];
  row.forEach((cell, index) => {
    const cellTokens = collectTokensFromCell(cell);
    const cellText = normalizeWorkbookText(stringifyCell(cell));
    const matched = cellTokens.some((token) => token === normalizedHeader || token.includes(normalizedHeader) || normalizedHeader.includes(token)) || cellText.includes(normalizedHeader) || normalizedHeader.includes(cellText);
    if (matched) {
      columns.push(index + 1);
    }
  });
  return columns;
}

function collectTokensFromCell(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTokensFromCell(item));
  }
  if (value instanceof Date) {
    return [normalizeWorkbookText(value.toISOString())];
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((item) => collectTokensFromCell(item));
  }
  return String(value)
    .split(/[\n\r,;|/]+/)
    .map((part) => normalizeWorkbookText(part))
    .filter(Boolean);
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function truncateRow(row: unknown[]): unknown[] {
  return row.slice(0, 30).map((value) => truncateValue(value));
}

function truncateValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => truncateValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([key, item]) => [key, truncateValue(item)])
    );
  }
  return value;
}

function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function normalizeWorkbookText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.%$_#]/gi, '')
    .toUpperCase();
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function statusLabel(status: WorkbookTableScan['status']): string {
  if (status === 'found') {
    return 'alta';
  }
  if (status === 'partial') {
    return 'media/baja';
  }
  return 'no encontrado';
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}
