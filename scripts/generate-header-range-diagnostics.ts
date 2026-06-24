import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildRangeSuggestions,
  findHeaderRangeCandidates,
  getMissingOfficialTablesBySheet,
  type HeaderRangeRow
} from '../src/imports/excel/header-range-analysis';

type ImportBatchRecord = {
  id: string;
  fileName: string | null;
  originalFileName?: string | null;
  status: string;
  createdAt: Date;
};

const prisma = new PrismaClient();
const outputDir = join(process.cwd(), 'docs', 'import-diagnostics');

async function main(): Promise<void> {
  const importBatchId = process.argv[2];

  if (!importBatchId) {
    throw new Error('Debes pasar un importBatchId. Ejemplo: npm run import:headers -- <importBatchId>');
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

  const groupedBySheet = groupRowsBySheet(rows as HeaderRangeRow[]);
  const allCandidates = groupedBySheet.flatMap((group) => findHeaderRangeCandidates(group.rows));
  const rangeSuggestions = buildRangeSuggestions(allCandidates);
  const missingOfficialTables = getMissingOfficialTablesBySheet(allCandidates);
  const markdown = buildMarkdown(batch as unknown as ImportBatchRecord, rows.length, groupedBySheet, allCandidates, rangeSuggestions, missingOfficialTables);

  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `import-batch-${importBatchId}-headers.md`);
  writeFileSync(outputPath, markdown, 'utf8');

  console.log(`Diagnostico de cabeceras generado en: ${outputPath}`);
}

function groupRowsBySheet(rows: HeaderRangeRow[]): Array<{ sheet: string; rows: HeaderRangeRow[] }> {
  const grouped = new Map<string, HeaderRangeRow[]>();

  for (const row of rows) {
    const key = row.sourceSheet;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  return Array.from(grouped.entries()).map(([sheet, sheetRows]) => ({
    sheet,
    rows: sheetRows.sort((a, b) => Number.parseInt(a.sourceRowId, 10) - Number.parseInt(b.sourceRowId, 10))
  }));
}

function buildMarkdown(
  batch: ImportBatchRecord,
  rowsImported: number,
  groupedBySheet: Array<{ sheet: string; rows: HeaderRangeRow[] }>,
  candidates: ReturnType<typeof findHeaderRangeCandidates>,
  rangeSuggestions: ReturnType<typeof buildRangeSuggestions>,
  missingOfficialTables: ReturnType<typeof getMissingOfficialTablesBySheet>
): string {
  const confidenceCounts = {
    alta: candidates.filter((candidate) => candidate.confidence === 'alta').length,
    media: candidates.filter((candidate) => candidate.confidence === 'media').length,
    baja: candidates.filter((candidate) => candidate.confidence === 'baja').length
  };

  const sheetBlocks = groupedBySheet
    .map((group) => {
      const sheetCandidates = candidates
        .filter((candidate) => candidate.sourceSheet === group.sheet && candidate.confidence !== 'descartar')
        .sort((a, b) => b.score - a.score || a.rowNumber - b.rowNumber);

      const rowsTable = [
        '| bloque | fila bloque | tabla sugerida | score | confianza | headers encontrados |',
        '|---|---:|---|---:|---|---|',
        ...sheetCandidates.slice(0, 20).map(
          (candidate) =>
            `| ${escapeCell(candidate.sourceTable)} | ${candidate.rowNumber} | ${escapeCell(candidate.tableLogic)} | ${candidate.score.toFixed(3)} | ${candidate.confidence} | ${escapeCell(candidate.headersFound.join(', '))} |`
        )
      ].join('\n');

      return [
        `### Hoja: ${group.sheet}`,
        '',
        rowsTable,
        ''
      ].join('\n');
    })
    .join('\n');

  const detailSections = candidates
    .filter((candidate) => candidate.confidence !== 'descartar')
    .sort((a, b) => b.score - a.score || a.rowNumber - b.rowNumber)
    .slice(0, 120)
    .map((candidate) => {
      const sampleRowsAfterHeader = candidate.sampleRowsAfterHeader.slice(0, 3).map((row) => truncateJson(row));
      return [
        `### ${candidate.sourceSheet} / ${candidate.sourceTable} / fila ${candidate.rowNumber} -> ${candidate.tableLogic}`,
        '',
        `- Score: ${candidate.score.toFixed(3)}`,
        `- Confianza: ${candidate.confidence}`,
        `- Match en keys: ${candidate.matchedFromKeys.length ? candidate.matchedFromKeys.join(', ') : 'ninguno'}`,
        `- Match en values: ${candidate.matchedFromValues.length ? candidate.matchedFromValues.join(', ') : 'ninguno'}`,
        `- Headers encontrados: ${candidate.headersFound.length ? candidate.headersFound.join(', ') : 'ninguno'}`,
        `- Headers faltantes: ${candidate.headersMissing.length ? candidate.headersMissing.join(', ') : 'ninguno'}`,
        `- Rango probable: ${candidate.probableStartRow} - ${candidate.probableEndRow ?? 'final del bloque'}`,
        `- Comentario: ${candidate.comment}`,
        '',
        '#### Fila candidata',
        '',
        '```json',
        JSON.stringify(truncateJson(candidate.rawRow), null, 2),
        '```',
        '',
        '#### Primeras filas despues de la candidata',
        '',
        '```json',
        JSON.stringify(sampleRowsAfterHeader, null, 2),
        '```',
        ''
      ].join('\n');
    })
    .join('\n');

  const rangeTable = [
    '| tabla logica | sourceSheet | sourceTable | headerRow | probableEndRow | confianza | comentario |',
    '| ------------ | ----------- | ----------- | --------: | -------------: | --------- | ---------- |',
    ...rangeSuggestions.map(
      (item) =>
        `| ${escapeCell(item.tableLogic)} | ${escapeCell(item.sourceSheet)} | ${escapeCell(item.sourceTable)} | ${item.headerRow} | ${item.probableEndRow ?? ''} | ${item.confidence} | ${escapeCell(item.comment)} |`
    )
  ].join('\n');

  const missingTableRows = missingOfficialTables.length
    ? missingOfficialTables.map((item) => `| ${escapeCell(item.sheet)} | ${escapeCell(item.table)} | ${escapeCell(item.reason)} |`).join('\n')
    : '| ninguna | ninguna | ninguna |';

  const recommendation = buildRecommendationText(candidates);

  return [
    '# Diagnostico de cabeceras y rangos',
    '',
    '## ImportBatch',
    '',
    `- ID: ${batch.id}`,
    `- Archivo: ${batch.fileName ?? batch.originalFileName ?? 'sin archivo'}`,
    `- Estado: ${batch.status}`,
    `- Fecha: ${formatDate(batch.createdAt)}`,
    `- Filas importadas: ${rowsImported}`,
    '',
    '## Resumen ejecutivo',
    '',
    `- Total de candidatos encontrados: ${candidates.filter((candidate) => candidate.confidence !== 'descartar').length}`,
    `- Candidatos alta confianza: ${confidenceCounts.alta}`,
    `- Candidatos media confianza: ${confidenceCounts.media}`,
    `- Hojas con tablas pendientes: ${[...new Set(missingOfficialTables.map((item) => item.sheet))].join(', ') || 'ninguna'}`,
    '',
    '## Candidatos por hoja',
    '',
    sheetBlocks || '_Sin candidatos de cabecera._',
    '',
    '## Detalle de candidatos',
    '',
    detailSections || '_Sin candidatos suficientes._',
    '',
    '## Rango sugerido por tabla logica',
    '',
    rangeTable,
    '',
    '## Tablas esperadas no encontradas',
    '',
    '| hoja | tabla esperada | motivo |',
    '| ---- | -------------- | ------ |',
    missingTableRows,
    '',
    '## Recomendacion',
    '',
    recommendation,
    ''
  ].join('\n');
}

function buildRecommendationText(candidates: ReturnType<typeof findHeaderRangeCandidates>): string {
  const detected = candidates
    .filter((candidate) => candidate.confidence !== 'descartar')
    .map((candidate) => candidate.tableLogic);

  const order = ['Tabla47', 'Tabla5', 'Tabla11', 'TablaPosiciones', 'Tabla_OrdenesPendientes', 'TablaCalendario', 'TablaCalendarioRem', 'TablaCalendarioInf', 'Tabla6', 'Tabla13', 'TablaMovimientosInversiones'];
  const recommended = order.filter((table) => detected.includes(table));

  return [
    `Se detectaron con confianza las tablas: ${recommended.join(', ') || 'ninguna'}.`,
    'Las tablas con score medio o bajo necesitan revision manual antes de normalizar.',
    `Orden sugerido de normalizacion: ${order.join(' -> ')}.`
  ].join(' ');
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function truncateJson(value: unknown, maxDepth = 2, maxKeys = 20): unknown {
  if (maxDepth <= 0) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => truncateJson(item, maxDepth - 1, maxKeys));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, maxKeys)
        .map(([key, item]) => [key, truncateJson(item, maxDepth - 1, maxKeys)])
    );
  }
  return value;
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
