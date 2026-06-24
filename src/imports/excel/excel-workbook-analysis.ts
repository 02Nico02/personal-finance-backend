import type { Prisma } from '@prisma/client';
import {
  getNormalizationOrder,
  getOfficialSheetNames,
  getOfficialTableNamesForSheet,
  getOfficialTablesForSheet,
  isOfficialSheet,
  isOfficialTableForSheet,
} from './excel-workbook-map';

export type ImportedRowRecord = {
  sourceSheet: string;
  sourceTable: string;
  sourceRowId: string;
  rawData: Prisma.JsonValue | null;
  normalizedData: Prisma.JsonValue | null;
};

export type TableDiagnostic = {
  sourceSheet: string;
  sourceTable: string;
  rows: ImportedRowRecord[];
  headers: string[];
  averageColumns: number;
  emptyRowsPercent: number;
  suggestion: string;
  confidence: string;
  reason: string;
  officialSheet: boolean;
  expectedTables: string[];
  suggestionInOfficialMap: boolean;
};

export type SheetComparison = {
  sheet: string;
  expectedTables: string[];
  detectedTables: string[];
  identifiedTables: string[];
  pendingTables: string[];
};

export type NormalizationRecommendation = {
  order: number;
  tableLogic: string;
  motivo: string;
  estado: string;
};

export function groupRowsByTable(rows: ImportedRowRecord[]): TableDiagnostic[] {
  const grouped = new Map<string, ImportedRowRecord[]>();

  for (const row of rows) {
    const key = `${row.sourceSheet}|||${row.sourceTable}`;
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  }

  return Array.from(grouped.entries()).map(([key, groupRows]) => {
    const [sourceSheet, sourceTable] = key.split('|||');
    const headers = extractHeaders(groupRows);
    const averageColumns = groupRows.length
      ? groupRows.reduce((sum, row) => sum + getObjectKeyCount(row.rawData), 0) / groupRows.length
      : 0;
    const emptyRowsPercent = groupRows.length ? (countSparseRows(groupRows) / groupRows.length) * 100 : 0;
    const suggestion = suggestLogicalTable(sourceSheet, sourceTable, headers);
    const confidence = getConfidence(headers, suggestion);
    const reason = getReason(sourceSheet, sourceTable, headers, suggestion);
    const expectedTables = getOfficialTablesForSheet(sourceSheet).map((table) => table.name);

    return {
      sourceSheet,
      sourceTable,
      rows: groupRows,
      headers,
      averageColumns,
      emptyRowsPercent,
      suggestion,
      confidence,
      reason,
      officialSheet: isOfficialSheet(sourceSheet),
      expectedTables,
      suggestionInOfficialMap: isOfficialTableForSheet(sourceSheet, suggestion)
    };
  });
}

export function compareToOfficialMap(diagnostics: TableDiagnostic[]): SheetComparison[] {
  const grouped = new Map<string, TableDiagnostic[]>();

  for (const diagnostic of diagnostics) {
    const group = grouped.get(diagnostic.sourceSheet) ?? [];
    group.push(diagnostic);
    grouped.set(diagnostic.sourceSheet, group);
  }

  const sheetNames = new Set<string>([...Array.from(grouped.keys()), ...getOfficialSheetNames()]);

  return Array.from(sheetNames).map((sheet) => {
    const expectedTables = getOfficialTableNamesForSheet(sheet);
    const sheetDiagnostics = grouped.get(sheet) ?? [];
    const detectedTables = [...new Set(sheetDiagnostics.map((item) => item.sourceTable))];
    const identifiedTables = [...new Set(sheetDiagnostics.filter((item) => item.suggestionInOfficialMap).map((item) => item.suggestion))];
    const pendingTables = detectedTables.filter((table) => !identifiedTables.includes(table));

    return {
      sheet,
      expectedTables,
      detectedTables,
      identifiedTables,
      pendingTables
    };
  });
}

export function buildNormalizationRecommendation(diagnostics: TableDiagnostic[]): NormalizationRecommendation[] {
  const priority = getNormalizationOrder();
  const byTable = new Map<string, TableDiagnostic>();
  for (const diagnostic of diagnostics) {
    if (!byTable.has(diagnostic.suggestion) && diagnostic.suggestion !== 'Desconocida') {
      byTable.set(diagnostic.suggestion, diagnostic);
    }
  }

  return priority.map((tableLogic, index) => {
    const diagnostic = byTable.get(tableLogic);
    return {
      order: index + 1,
      tableLogic,
      motivo: diagnostic?.reason ?? 'Tabla prioritaria para la primera normalizacion.',
      estado: diagnostic ? 'detectada' : 'pendiente'
    };
  });
}

function extractHeaders(rows: ImportedRowRecord[]): string[] {
  const headers = new Set<string>();
  for (const row of rows.slice(0, 5)) {
    if (isPlainObject(row.rawData)) {
      Object.keys(row.rawData).forEach((header) => headers.add(header));
    }
  }
  return Array.from(headers);
}

export function suggestLogicalTable(sourceSheet: string, sourceTable: string, headers: string[]): string {
  const normalized = headers.map(normalizeText);
  const headerSet = new Set(normalized);
  const sheet = normalizeText(sourceSheet);
  const table = normalizeText(sourceTable);

  const containsAll = (values: string[]): boolean => values.every((value) => headerSet.has(normalizeText(value)));
  const containsSome = (values: string[]): number =>
    values.reduce((count, value) => count + (headerSet.has(normalizeText(value)) ? 1 : 0), 0);

  if (sheet === 'alertas') {
    if (containsSome(['ESPECIE', 'TIPO', 'SECTOR', 'SUBSECTOR', 'REGION']) >= 4) {
      return 'Tabla47';
    }
  }

  if (sheet === 'historialinversiones') {
    if (containsSome(['FECHA', 'MES', 'ESPECIE', 'PRECIO']) >= 4) {
      return 'Tabla5';
    }
    if (containsSome(['FECHA', 'MES', 'BALANCE']) >= 3) {
      return 'Tabla14';
    }
    if (containsSome(['ANO', 'VALINICIO', 'COMPRAS', 'VENTAS', 'VALFIN', 'RESULTADO', 'REND']) >= 5) {
      return 'Tabla60';
    }
    if (containsSome(['MES', 'VALINICIO', 'COMPRAS', 'VENTAS', 'VALFIN', 'RESULTADO', 'VARIACION%']) >= 5) {
      return 'HistorialMensualReconstruido';
    }
  }

  if (sheet === 'inversiones') {
    if (containsSome(['ID', 'FECHA', 'ESPECIE', 'MONEDA', 'CANT.', 'PREC. COMP.', 'TOTAL', 'PREC. ACT.', 'VALORI. ACT.', 'VARIACION', 'TEM', 'TNA']) >= 8) {
      return 'Tabla6';
    }
    if (
      containsSome(['FECHA COM.', 'FECHA VENT.', 'ESPECIE', 'MONEDA', 'CANT.', 'PREC. COMP.', 'TOTAL', 'PREC.EN V.', 'VALORI. ACT.', 'MONTO', 'OBJETIVO MINIMO']) >= 7
    ) {
      return 'Tabla13';
    }
    if (containsSome(['ESPECIE', 'MONEDA', 'TIPO', 'CANTIDAD', 'TOTAL INV', 'PRECIO ACT', 'TOTAL ACTUAL', 'RESULTADO $', 'RESULTADO %', 'PRECIO PROM']) >= 7) {
      return 'TablaPosiciones';
    }
    if (containsSome(['FONDOS COM. INV.']) >= 1) {
      return 'Tabla11';
    }
    if (containsSome(['FECHA', 'ESPECIE', 'TIPO MOVIMIENTO', 'MONTO', 'AFECTA RENDIMIENTO', 'AFECTA CAPITAL INVERTIDO', 'OBSERVACION']) >= 4) {
      return 'TablaMovimientosInversiones';
    }
    if (containsSome(['ESPECIE', 'CANT', 'PRECIO']) >= 3 && normalized.length <= 6) {
      return 'Tabla_OrdenesPendientes';
    }
    if (containsSome(['MES', 'TOTAL DEL MES', 'ACUMULADO', 'VAL. INICIO', 'VARIACION %', 'REND. REAL']) >= 4) {
      return 'Tabla9';
    }
  }

  if (sheet === 'tabla dinamica') {
    if (containsSome(['FECHA', 'TNA', 'REND_DIARIA', 'INDICE']) >= 4) {
      if (containsSome(['INFLACION MENSUAL', 'REND_DIARIA_INF', 'INDICE_INF', 'DIAS DEL MES']) >= 2) {
        return 'TablaCalendarioInf';
      }
      return 'TablaCalendario';
    }
    if (containsSome(['FECHA', 'MES', 'REND_DIARIA_INF', 'INDICE_INF']) >= 3) {
      return 'TablaCalendarioInf';
    }
    if (containsSome(['FECHA', 'TNA', 'REND_DIARIA', 'INDICE']) >= 4) {
      return 'TablaCalendarioRem';
    }
  }

  if (sheet === 'graficos') {
    if (containsSome(['FECHA', 'VALOR AR', 'VALOR USD', '% JUBILACION', '% AHORRO', 'MONTO JUB. AR', 'MONTO AHOR. AR']) >= 5) {
      return 'Tabla35';
    }
    if (containsSome(['PLATAFORMA', 'MONTO', 'MONEDA']) >= 3) {
      return 'Tabla38';
    }
    if (containsSome(['CUATRIMESTRE', 'ANO', 'INGRESO', 'EGRESO', 'BALANCE']) >= 4) {
      return 'Tabla39';
    }
  }

  if (containsAll(['FECHA', 'MES', 'ESPECIE', 'PRECIO'])) {
    return 'Tabla5';
  }

  if (containsSome(['ESPECIE', 'TIPO', 'SECTOR', 'SUBSECTOR', 'REGION']) >= 4) {
    return 'Tabla47';
  }

  if (containsSome(['ESPECIE', 'CANT', 'PRECIO']) >= 3 && normalized.length <= 6) {
    return 'Tabla_OrdenesPendientes';
  }

  if (containsAll(['FECHA', 'TNA', 'REND_DIARIA', 'INDICE'])) {
    if (containsSome(['INFLACION MENSUAL', 'REND_DIARIA_INF', 'INDICE_INF', 'DIAS DEL MES']) >= 2) {
      return 'TablaCalendarioInf';
    }
    return 'TablaCalendario';
  }

  if (containsSome(['FECHA', 'MES', 'REND_DIARIA_INF', 'INDICE_INF']) >= 3) {
    return 'TablaCalendarioInf';
  }

  if (containsSome(['FECHA', 'BALANCE']) >= 2 && containsSome(['MES']) >= 1) {
    return 'Tabla14';
  }

  if (containsSome(['FECHA', 'VALOR AR', '% JUBILACION', '% AHORRO']) >= 3) {
    return 'Tabla35';
  }

  if (sheet.includes('historial') && table.includes('tabla5')) {
    return 'Tabla5';
  }

  if (sheet.includes('graficos') || table.includes('graficos')) {
    return 'Desconocida';
  }

  return 'Desconocida';
}

export function getConfidence(headers: string[], suggestion: string): string {
  if (suggestion === 'Desconocida') {
    return headers.length ? 'baja' : 'muy baja';
  }

  const score = headers.length;
  if (score >= 8) {
    return 'alta';
  }
  if (score >= 4) {
    return 'media';
  }
  return 'baja';
}

export function getReason(sourceSheet: string, sourceTable: string, headers: string[], suggestion: string): string {
  if (suggestion === 'Desconocida') {
    return `No hubo coincidencia suficiente entre headers y heuristicas para ${sourceSheet}/${sourceTable}.`;
  }

  const normalized = headers.map(normalizeText);
  if (suggestion === 'Tabla6') {
    return `Se detectaron headers tipicos de compras/lotes abiertos: ${normalized.join(', ')}.`;
  }
  if (suggestion === 'Tabla13') {
    return `Se detectaron headers tipicos de ventas/cierres: ${normalized.join(', ')}.`;
  }
  if (suggestion === 'TablaPosiciones') {
    return `Se detectaron headers tipicos de posiciones actuales: ${normalized.join(', ')}.`;
  }
  if (suggestion === 'Tabla5') {
    return `La hoja contiene fecha/mes/especie/precio, patron habitual de precios historicos.`;
  }
  if (suggestion === 'Tabla47') {
    return `La hoja contiene columnas de clasificacion como tipo, sector, subsector y region.`;
  }
  if (suggestion === 'Tabla_OrdenesPendientes') {
    return `Se detecto la forma compacta ESPECIE/Cant/PRECIO con pocas columnas.`;
  }
  if (suggestion === 'TablaCalendarioInf') {
    return `Se detectaron headers de benchmark con componente inflacionario.`;
  }
  if (suggestion === 'TablaCalendario') {
    return `Se detectaron headers de benchmark con fecha, TNA, rendimiento diario e indice.`;
  }
  if (suggestion === 'Tabla14') {
    return `Se detectaron columnas de balance y fecha/mes.`;
  }
  if (suggestion === 'Tabla35') {
    return `Se detectaron columnas de distribucion estrategica / porcentajes.`;
  }
  if (suggestion === 'Tabla60') {
    return `Se detectaron columnas de resumen historico anual.`;
  }
  if (suggestion === 'HistorialMensualReconstruido') {
    return `Se detectaron columnas de reconstruccion mensual historica.`;
  }
  if (suggestion === 'Tabla9') {
    return `Se detectaron columnas de resumen mensual de resultados.`;
  }
  return `Heuristica generica aplicada sobre ${sourceSheet}/${sourceTable}.`;
}

function countSparseRows(rows: ImportedRowRecord[]): number {
  return rows.filter((row) => getNonEmptyValueCount(row.rawData) <= 2).length;
}

function getNonEmptyValueCount(value: Prisma.JsonValue | null): number {
  if (!isPlainObject(value)) {
    return value === null ? 0 : 1;
  }

  return Object.values(value).filter((item) => item !== null && item !== undefined && String(item).trim() !== '').length;
}

function getObjectKeyCount(value: Prisma.JsonValue | null): number {
  return isPlainObject(value) ? Object.keys(value).length : value === null ? 0 : 1;
}

function isPlainObject(value: Prisma.JsonValue | null): value is Record<string, Prisma.JsonValue> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}
