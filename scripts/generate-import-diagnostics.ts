import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildNormalizationRecommendation,
  compareToOfficialMap,
  groupRowsByTable,
  type ImportedRowRecord
} from '../src/imports/excel/excel-workbook-analysis';
import { getOfficialSheetNames } from '../src/imports/excel/excel-workbook-map';
import {
  getOfficialTablesForSheet
} from '../src/imports/excel/excel-workbook-map';

type ImportBatchRecord = {
  id: string;
  fileName: string | null;
  originalFileName?: string | null;
  checksum: string | null;
  status: string;
  detectedTables?: unknown;
  createdAt: Date;
};

const prisma = new PrismaClient();
const outputDir = join(process.cwd(), 'docs', 'import-diagnostics');

async function main(): Promise<void> {
  const importBatchId = process.argv[2];

  if (!importBatchId) {
    throw new Error('Debes pasar un importBatchId. Ejemplo: npm run import:diagnostics -- <importBatchId>');
  }

  const batch = await prisma.importBatch.findUnique({
    where: { id: importBatchId }
  });

  if (!batch) {
    throw new Error(`No se encontro un ImportBatch con id ${importBatchId}.`);
  }

  const rows = await (prisma as any).importedRow.findMany({
    where: { importBatchId },
    orderBy: [{ sourceSheet: 'asc' }, { sourceTable: 'asc' }, { createdAt: 'asc' }]
  });

  const diagnostics = groupRowsByTable(rows as ImportedRowRecord[]);
  const comparisons = compareToOfficialMap(diagnostics);
  const recommendations = buildNormalizationRecommendation(diagnostics);
  const markdown = buildMarkdown(batch as unknown as ImportBatchRecord, rows.length, diagnostics, comparisons, recommendations);

  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `import-batch-${importBatchId}.md`);
  writeFileSync(outputPath, markdown, 'utf8');

  console.log(`Diagnostico generado en: ${outputPath}`);
}

function buildMarkdown(
  batch: ImportBatchRecord,
  rowsImported: number,
  diagnostics: ReturnType<typeof groupRowsByTable>,
  comparisons: ReturnType<typeof compareToOfficialMap>,
  recommendations: ReturnType<typeof buildNormalizationRecommendation>
): string {
  const detectedTables = Array.isArray(batch.detectedTables) ? batch.detectedTables.map(String) : [];
  const sortedDiagnostics = [...diagnostics].sort((a, b) =>
    `${a.sourceSheet}/${a.sourceTable}`.localeCompare(`${b.sourceSheet}/${b.sourceTable}`)
  );
  const comparisonBySheet = new Map(comparisons.map((item) => [item.sheet, item]));

  const summaryTable = [
    '| sourceSheet | sourceTable | filas | columnas detectadas | sugerencia |',
    '|---|---:|---:|---:|---|',
    ...sortedDiagnostics.map(
      (item) =>
        `| ${escapeCell(item.sourceSheet)} | ${escapeCell(item.sourceTable)} | ${item.rows.length} | ${item.headers.length} | ${escapeCell(item.suggestion)} |`
    )
  ].join('\n');

  const mappingTable = [
    '| sourceSheet | sourceTable | tabla logica sugerida | confianza | mapa esperado |',
    '|---|---|---|---:|---|',
    ...sortedDiagnostics.map(
      (item) =>
        `| ${escapeCell(item.sourceSheet)} | ${escapeCell(item.sourceTable)} | ${escapeCell(item.suggestion)} | ${escapeCell(item.confidence)} | ${item.suggestionInOfficialMap ? 'si' : 'no'} |`
    )
  ].join('\n');

  const officialMapTable = [
    '| hoja | tablas esperadas |',
    '|---|---|',
    ...getOfficialSheetNames().map(
      (sheet) => `| ${escapeCell(sheet)} | ${escapeCell(getOfficialTablesForSheet(sheet).map((table) => table.name).join(', '))} |`
    )
  ].join('\n');

  const comparisonTable = [
    '| hoja | tablas esperadas | bloques detectados | tablas identificadas | pendientes |',
    '|---|---|---|---|---|',
    ...comparisons.map((comparison) => {
      const expectedTables = comparison.expectedTables.length ? comparison.expectedTables : getOfficialTablesForSheet(comparison.sheet).map((table) => table.name);
      return `| ${escapeCell(comparison.sheet)} | ${escapeCell(expectedTables.join(', ') || 'ninguna')} | ${escapeCell(comparison.detectedTables.join(', ') || 'ninguno')} | ${escapeCell(
        comparison.identifiedTables.join(', ') || 'ninguna'
      )} | ${escapeCell(comparison.pendingTables.join(', ') || 'ninguno')} |`;
    })
  ].join('\n');

  const detailSections = sortedDiagnostics
    .map((item) => {
      const rawSample = item.rows.slice(0, 3).map((row) => normalizeJson(row.rawData));
      const normalizedSample = item.rows.slice(0, 3).map((row) => normalizeJson(row.normalizedData));

      return [
        `### ${item.sourceSheet} / ${item.sourceTable}`,
        '',
        `- hoja oficial: ${item.officialSheet ? 'si' : 'no'}`,
        `- tablas esperadas en esa hoja: ${item.expectedTables.length ? item.expectedTables.join(', ') : 'ninguna'}`,
        `- Filas: ${item.rows.length}`,
        `- Columnas promedio: ${item.averageColumns.toFixed(2)}`,
        `- Filas vacias o con pocos datos: ${item.emptyRowsPercent.toFixed(1)}%`,
        `- Headers detectados: ${item.headers.length ? item.headers.join(', ') : 'sin headers claros'}`,
        `- Sugerencia de tabla logica: ${item.suggestion}`,
        `- La tabla sugerida esta en el mapa esperado: ${item.suggestionInOfficialMap ? 'si' : 'no'}`,
        `- Confianza: ${item.confidence}`,
        `- Motivo: ${item.reason}`,
        '',
        '#### Muestra rawData',
        '',
        '```json',
        JSON.stringify(rawSample, null, 2),
        '```',
        '',
        '#### Muestra normalizedData',
        '',
        '```json',
        JSON.stringify(normalizedSample, null, 2),
        '```'
      ].join('\n');
    })
    .join('\n\n');

  const pendingDecisions = collectPendingDecisions(sortedDiagnostics);

  const recommendationTable = [
    '| orden | tabla logica | motivo | estado |',
    '|---:|---|---|---|',
    ...recommendations.map(
      (item) =>
        `| ${item.order} | ${escapeCell(item.tableLogic)} | ${escapeCell(item.motivo)} | ${escapeCell(item.estado)} |`
    )
  ].join('\n');

  return [
    '# Diagnostico de importacion Excel',
    '',
    '## ImportBatch',
    '',
    `- ID: ${batch.id}`,
    `- Archivo: ${batch.fileName ?? batch.originalFileName ?? 'sin archivo'}`,
    `- Estado: ${batch.status}`,
    `- Checksum: ${batch.checksum ?? 'sin checksum'}`,
    `- Fecha: ${formatDate(batch.createdAt)}`,
    `- Filas importadas: ${rowsImported}`,
    `- Tablas/bloques detectados: ${detectedTables.length ? detectedTables.join(', ') : 'ninguna'}`,
    '',
    '## Mapa oficial esperado',
    '',
    officialMapTable,
    '',
    '## Resumen por tabla/bloque',
    '',
    summaryTable,
    '',
    '## Comparacion contra mapa oficial',
    '',
    comparisonTable,
    '',
    '## Detalle por tabla/bloque',
    '',
    detailSections || '_Sin filas importadas._',
    '',
    '## Mapeo sugerido',
    '',
    mappingTable,
    '',
    '## Recomendacion de normalizacion',
    '',
    recommendationTable,
    '',
    '## Pendientes de decision',
    '',
    pendingDecisions.length ? pendingDecisions.map((line) => `* ${line}`).join('\n') : '* Sin pendientes obvios en este batch.',
    ''
  ].join('\n');
}

function collectPendingDecisions(
  diagnostics: ReturnType<typeof groupRowsByTable>
): string[] {
  const pending: string[] = [];
  const unknown = diagnostics.filter((item) => item.suggestion === 'Desconocida');
  if (unknown.length) {
    pending.push(`Bloques no identificados: ${unknown.map((item) => `${item.sourceSheet}/${item.sourceTable}`).join(', ')}`);
  }

  const ambiguous = diagnostics.filter((item) => item.confidence === 'baja' && item.suggestion !== 'Desconocida');
  if (ambiguous.length) {
    pending.push(`Bloques con heuristica debil: ${ambiguous.map((item) => `${item.sourceSheet}/${item.sourceTable}`).join(', ')}`);
  }

  return pending;
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => normalizeJson(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([key, item]) => [key, normalizeJson(item)])
    );
  }
  return value;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function formatDate(value: Date | string | null): string {
  if (!value) {
    return 'sin fecha';
  }
  return new Date(value).toISOString();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
