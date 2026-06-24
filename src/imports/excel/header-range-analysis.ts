import type { Prisma } from '@prisma/client';
import { getOfficialSheetNames, getOfficialTableDefinition, getOfficialTablesForSheet, isOfficialSheet, isOfficialTableForSheet } from './excel-workbook-map';

export type HeaderRangeRow = {
  id: string;
  importBatchId: string;
  sourceSheet: string;
  sourceTable: string;
  sourceRowId: string;
  rawData: Prisma.JsonValue | null;
  normalizedData: Prisma.JsonValue | null;
  createdAt?: Date | string;
};

export type HeaderRangeCandidate = {
  sourceSheet: string;
  sourceTable: string;
  rowNumber: number;
  tableLogic: string;
  score: number;
  confidence: 'alta' | 'media' | 'baja' | 'descartar';
  matchedFromKeys: string[];
  matchedFromValues: string[];
  headersFound: string[];
  headersMissing: string[];
  probableStartRow: number;
  probableEndRow: number | null;
  sampleRowsAfterHeader: unknown[];
  rawRow: Record<string, unknown>;
  comment: string;
  officialSheet: boolean;
  inOfficialMap: boolean;
};

export type RangeSuggestion = {
  tableLogic: string;
  sourceSheet: string;
  sourceTable: string;
  headerRow: number;
  probableEndRow: number | null;
  confidence: string;
  comment: string;
};

export const EXTRA_EXPECTED_HEADERS: Record<string, string[]> = {
  Tabla6: ['ID', 'Fecha', 'ESPECIE', 'MONEDA', 'CANT.', 'PREC. COMP.', 'TOTAL', 'PREC. ACT.', 'VALORI. ACT.', 'VARIACION', 'Monto', 'TEM', 'TNA'],
  Tabla13: ['Fecha Com.', 'Fecha Vent.', 'ESPECIE', 'MONEDA', 'CANT.', 'PREC. COMP.', 'TOTAL', 'PREC.en V.', 'VALORI. ACT.', 'VARIACION', 'Monto', 'objetivo minimo'],
  TablaPosiciones: ['ESPECIE', 'MONEDA', 'TIPO', 'CANTIDAD', 'TOTAL INV', 'PRECIO ACT', 'TOTAL ACTUAL', 'RESULTADO $', 'RESULTADO %', 'PRECIO PROM'],
  Tabla11: ['Fondos com. Inv.'],
  TablaMovimientosInversiones: ['Fecha', 'Especie', 'Tipo movimiento', 'Monto', 'Afecta rendimiento', 'Afecta capital invertido', 'Observacion'],
  Tabla_OrdenesPendientes: ['ESPECIE', 'Cant', 'PRECIO'],
  Tabla9: ['MES', 'TOTAL DEL MES', 'ACUMULADO', 'Val. Inicio', 'VARIACION %', 'REND. REAL'],
  Tabla5: ['ID', 'MES', 'FECHA', 'ESPECIE', 'PRECIO'],
  Tabla14: ['FECHA', 'MES', 'BALANCE'],
  Tabla60: ['Año', 'Ano', 'Val Inicio', 'Compras', 'Ventas', 'Val Fin', 'Resultado', 'Rend. %', 'Inflacion', 'Rend. Real', 'Ratio Aporte'],
  HistorialMensualReconstruido: ['MES', 'ValInicio', 'Compras', 'Ventas', 'ValFin', 'Resultado', 'VARIACION %', 'Inflacion %', 'Rend. Real %', 'Ratio Aporte', 'Tipo de Mes', 'Año', 'Ano'],
  Tabla47: ['ESPECIE', 'TIPO', 'SECTOR', 'SUBSECTOR', 'REGION', 'VALORI. ACT.', 'Monto', 'Esperado'],
  TablaCalendario: ['Fecha', 'TNA', 'Rend_diaria', 'Indice'],
  TablaCalendarioRem: ['Fecha', 'TNA', 'Rend_diaria', 'Indice'],
  TablaCalendarioInf: ['Fecha', 'Inflación mensual', 'Inflacion mensual', 'Días del mes', 'Dias del mes', 'Rend_diaria_inf', 'Indice_inf'],
  Tabla35: ['FECHA', 'VALOR AR', 'VALOR USD', '% JUBILACION', '% AHORRO', 'MONTO JUB. AR', 'MONTO JUB. USD', 'MONTO AHOR. AR', 'MONTO AHOR. USD'],
  Tabla38: ['Plataforma', 'Monto', 'moneda'],
  Tabla39: ['CUATRIMESTRE', 'AÑO', 'Ano', 'INGRESO', 'EGRESO', 'BALANCE']
};

export function normalizeHeaderText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.%$/#]/gi, '')
    .toUpperCase();
}

export function getExpectedHeadersForTable(tableName: string): string[] {
  const official = getOfficialTableDefinition(tableName);
  const officialHeaders = official?.requiredHeaders ?? [];
  const extraHeaders = EXTRA_EXPECTED_HEADERS[tableName] ?? [];
  return uniqueHeaders([...officialHeaders, ...extraHeaders]);
}

export function getExpectedHeadersForSheet(sheetName: string): Record<string, string[]> {
  return Object.fromEntries(getOfficialTablesForSheet(sheetName).map((table) => [table.name, getExpectedHeadersForTable(table.name)]));
}

export function scoreRowAgainstTable(row: HeaderRangeRow, tableName: string): HeaderRangeCandidate {
  const expectedHeaders = getExpectedHeadersForTable(tableName);
  const rawObject = isPlainObject(row.rawData) ? (row.rawData as Record<string, unknown>) : {};
  const keyPool = Object.keys(rawObject).map(normalizeHeaderText);
  const valuePool = collectValueTokens(rawObject);
  const rowText = normalizeHeaderText(JSON.stringify(rawObject));

  const matchedFromKeys = expectedHeaders.filter((header) => matchesTokenInPool(header, keyPool) || rowText.includes(normalizeHeaderText(header)));
  const matchedFromValues = expectedHeaders.filter((header) => matchesTokenInPool(header, valuePool) || rowText.includes(normalizeHeaderText(header)));
  const matched = uniqueHeaders([...matchedFromKeys, ...matchedFromValues]);
  const score = expectedHeaders.length ? matched.length / expectedHeaders.length : 0;
  const missing = expectedHeaders.filter((header) => !matched.includes(header));
  const confidence = matched.length > 0 ? scoreToConfidence(score) : 'descartar';
  const rowNumber = parseRowNumber(row.sourceRowId);

  return {
    sourceSheet: row.sourceSheet,
    sourceTable: row.sourceTable,
    rowNumber,
    tableLogic: tableName,
    score: roundScore(score),
    confidence,
    matchedFromKeys,
    matchedFromValues,
    headersFound: matched,
    headersMissing: missing,
    probableStartRow: rowNumber,
    probableEndRow: null,
    sampleRowsAfterHeader: [],
    rawRow: rawObject,
    comment: buildComment(tableName, score, matched, missing, matchedFromKeys, matchedFromValues),
    officialSheet: isOfficialSheet(row.sourceSheet),
    inOfficialMap: isOfficialTableForSheet(row.sourceSheet, tableName)
  };
}

export function findHeaderRangeCandidates(rows: HeaderRangeRow[]): HeaderRangeCandidate[] {
  const sortedRows = [...rows].sort((a, b) => parseRowNumber(a.sourceRowId) - parseRowNumber(b.sourceRowId));
  const candidates: HeaderRangeCandidate[] = [];

  for (const row of sortedRows) {
    if (!isOfficialSheet(row.sourceSheet)) {
      continue;
    }

    for (const table of getOfficialTablesForSheet(row.sourceSheet)) {
      const candidate = scoreRowAgainstTable(row, table.name);
      if (candidate.confidence !== 'descartar' && candidate.score >= 0.25) {
        candidates.push(candidate);
      }
    }
  }

  const candidatesByTable = new Map<string, HeaderRangeCandidate[]>();
  for (const candidate of candidates) {
    const list = candidatesByTable.get(candidate.tableLogic) ?? [];
    list.push(candidate);
    candidatesByTable.set(candidate.tableLogic, list);
  }

  const topCandidates: HeaderRangeCandidate[] = [];
  for (const [tableLogic, list] of candidatesByTable.entries()) {
    const topPerTable = [...list].sort((a, b) => b.score - a.score || a.rowNumber - b.rowNumber).slice(0, 5);
    for (const candidate of topPerTable) {
      const nextCandidate = candidates
        .filter((other) => other.rowNumber > candidate.rowNumber)
        .sort((a, b) => a.rowNumber - b.rowNumber)[0];
      const probableEndRow = nextCandidate ? nextCandidate.rowNumber - 1 : sortedRows.length ? parseRowNumber(sortedRows[sortedRows.length - 1].sourceRowId) : null;
      const sampleRowsAfterHeader = sortedRows
        .filter((row) => parseRowNumber(row.sourceRowId) > candidate.rowNumber)
        .slice(0, 3)
        .map((row) => row.rawData);

      topCandidates.push({
        ...candidate,
        probableEndRow,
        sampleRowsAfterHeader,
        comment: `${candidate.comment} | rango probable calculado para ${tableLogic}.`
      });
    }
  }

  return topCandidates.sort((a, b) => b.score - a.score || a.rowNumber - b.rowNumber);
}

export function buildRangeSuggestions(candidates: HeaderRangeCandidate[]): RangeSuggestion[] {
  return candidates
    .filter((candidate) => candidate.confidence !== 'descartar')
    .map((candidate) => ({
      tableLogic: candidate.tableLogic,
      sourceSheet: candidate.sourceSheet,
      sourceTable: candidate.sourceTable,
      headerRow: candidate.rowNumber,
      probableEndRow: candidate.probableEndRow,
      confidence: candidate.confidence,
      comment: candidate.comment
    }));
}

export function getMissingOfficialTablesBySheet(candidates: HeaderRangeCandidate[]): Array<{ sheet: string; table: string; reason: string }> {
  const detectedBySheet = new Map<string, Set<string>>();

  for (const candidate of candidates) {
    if (candidate.confidence === 'descartar') {
      continue;
    }
    const set = detectedBySheet.get(candidate.sourceSheet) ?? new Set<string>();
    set.add(candidate.tableLogic);
    detectedBySheet.set(candidate.sourceSheet, set);
  }

  const missing: Array<{ sheet: string; table: string; reason: string }> = [];
  for (const sheet of getOfficialSheetNames()) {
    const detected = detectedBySheet.get(sheet) ?? new Set<string>();
    for (const table of getOfficialTablesForSheet(sheet)) {
      if (!detected.has(table.name)) {
        missing.push({
          sheet,
          table: table.name,
          reason: 'No se encontro una fila candidata con confianza suficiente.'
        });
      }
    }
  }

  return missing;
}

export function getAllOfficialTableNames(): string[] {
  return getOfficialSheetNames().flatMap((sheet) => getOfficialTablesForSheet(sheet).map((table) => table.name));
}

function collectValueTokens(rawObject: Record<string, unknown>): string[] {
  const tokens = new Set<string>();
  for (const value of Object.values(rawObject)) {
    collectTokensFromValue(value).forEach((token) => tokens.add(token));
  }
  return Array.from(tokens);
}

function collectTokensFromValue(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTokensFromValue(item));
  }
  if (value instanceof Date) {
    return [normalizeHeaderText(value.toISOString())];
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((item) => collectTokensFromValue(item));
  }
  return String(value)
    .split(/[\n\r,;|/]+/)
    .map((part) => normalizeHeaderText(part))
    .filter(Boolean);
}

function uniqueHeaders(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeHeaderText(value))));
}

function matchesTokenInPool(expectedHeader: string, pool: string[]): boolean {
  const normalizedExpected = normalizeHeaderText(expectedHeader);
  return pool.some((token) => token === normalizedExpected || token.includes(normalizedExpected) || normalizedExpected.includes(token));
}

function scoreToConfidence(score: number): 'alta' | 'media' | 'baja' | 'descartar' {
  if (score >= 0.7) {
    return 'alta';
  }
  if (score >= 0.45) {
    return 'media';
  }
  if (score >= 0.25) {
    return 'baja';
  }
  return 'descartar';
}

function buildComment(
  tableName: string,
  score: number,
  matched: string[],
  missing: string[],
  matchedFromKeys: string[],
  matchedFromValues: string[]
): string {
  const source = matchedFromValues.length ? 'values' : 'keys';
  const keyNote = matchedFromKeys.length ? ` Keys: ${matchedFromKeys.join(', ')}.` : '';
  return `${tableName}: score ${Math.round(score * 100)}% usando ${source}.${keyNote} Encontrados: ${matched.join(', ') || 'ninguno'}. Faltan: ${missing.join(', ') || 'ninguno'}.`;
}

function parseRowNumber(sourceRowId: string): number {
  const parsed = Number.parseInt(sourceRowId, 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function isPlainObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}
