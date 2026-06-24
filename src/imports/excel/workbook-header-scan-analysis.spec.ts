import { buildWorkbookScanMarkdown, buildConflicts, findSheetCandidates, scoreWorkbookRow } from './workbook-header-scan-analysis';

describe('workbook-header-scan-analysis', () => {
  const sheet = 'inversiones';

  it('detects Tabla6 from a raw array row', () => {
    const row = ['ID', 'Fecha', 'ESPECIE', 'MONEDA', 'CANT.', 'PREC. COMP.', 'TOTAL', 'PREC. ACT.', 'VALORI. ACT.', 'VARIACION', 'TEM', 'TNA'];
    const candidate = scoreWorkbookRow(sheet, 'Tabla6', row, row.map(String), 5, 12, [row]);

    expect(candidate).not.toBeNull();
    expect(candidate?.confidence).toBe('alta');
    expect(candidate?.headersFound).toContain('ESPECIE');
  });

  it('detects Tabla13 from a raw array row', () => {
    const row = ['Fecha Com.', 'Fecha Vent.', 'ESPECIE', 'MONEDA', 'CANT.', 'PREC. COMP.', 'TOTAL', 'PREC.en V.', 'VALORI. ACT.', 'VARIACIÓN', 'Monto', 'objetivo mínimo'];
    const candidate = scoreWorkbookRow(sheet, 'Tabla13', row, row.map(String), 8, 12, [row]);

    expect(candidate).not.toBeNull();
    expect(candidate?.headersFound).toContain('Fecha Vent.');
  });

  it('detects TablaPosiciones from a raw array row', () => {
    const row = ['ESPECIE', 'MONEDA', 'TIPO', 'CANTIDAD', 'TOTAL INV', 'PRECIO ACT', 'TOTAL ACTUAL', 'RESULTADO $', 'RESULTADO %', 'PRECIO PROM'];
    const candidate = scoreWorkbookRow(sheet, 'TablaPosiciones', row, row.map(String), 11, 10, [row]);

    expect(candidate).not.toBeNull();
    expect(candidate?.headersFound).toContain('RESULTADO %');
  });

  it('detects Tabla47 from a raw array row', () => {
    const row = ['ESPECIE', 'TIPO', 'SECTOR', 'SUBSECTOR', 'REGION', 'VALORI. ACT.', 'Monto', 'Esperado'];
    const candidate = scoreWorkbookRow('Alertas', 'Tabla47', row, row.map(String), 3, 8, [row]);

    expect(candidate).not.toBeNull();
    expect(candidate?.confidence).toBe('alta');
  });

  it('does not generate a candidate without headers', () => {
    const row = ['foo', 'bar', 'baz'];
    const candidate = scoreWorkbookRow(sheet, 'Tabla6', row, row.map(String), 1, 3, [row]);

    expect(candidate).toBeNull();
  });

  it('marks conflict when a row matches more than one table', () => {
    const row = ['ESPECIE', 'MONEDA', 'TIPO', 'CANTIDAD', 'TOTAL INV', 'PRECIO ACT', 'TOTAL ACTUAL', 'RESULTADO $', 'RESULTADO %', 'PRECIO PROM'];
    const candidates = [
      scoreWorkbookRow(sheet, 'TablaPosiciones', row, row.map(String), 10, 10, [row]),
      scoreWorkbookRow(sheet, 'Tabla_OrdenesPendientes', ['ESPECIE', 'Cant', 'PRECIO'], ['ESPECIE', 'Cant', 'PRECIO'], 10, 3, [row])
    ].filter(Boolean);

    const conflicts = buildConflicts(candidates as NonNullable<typeof candidates[number]>[]);

    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores accents and case in normalization', () => {
    const row = ['Fecha', 'Inflación mensual', 'Días del mes', 'Rend_diaria_inf', 'Indice_inf'];
    const candidate = scoreWorkbookRow('tabla dinamica', 'TablaCalendarioInf', row, row.map(String), 7, 5, [row]);

    expect(candidate).not.toBeNull();
    expect(candidate?.headersFound).toContain('Inflación mensual');
  });

  it('findSheetCandidates only scans official sheet tables', () => {
    const matrix = [
      ['ID', 'Fecha', 'ESPECIE', 'MONEDA', 'CANT.', 'PREC. COMP.', 'TOTAL', 'PREC. ACT.', 'VALORI. ACT.', 'VARIACION', 'TEM', 'TNA'],
      ['foo', 'bar']
    ];
    const candidates = findSheetCandidates(sheet, matrix);

    expect(candidates.some((candidate) => candidate.table === 'Tabla6')).toBe(true);
  });

  it('builds markdown from a workbook scan analysis', () => {
    const analysis = {
      workbookPath: './data/Historial Sueldo.xlsm',
      workbookSheets: ['inversiones', 'Alertas'],
      officialSheets: ['inversiones', 'Alertas'],
      ignoredSheets: ['Compras'],
      conflicts: [],
      tableScans: [
        {
          sheet: 'inversiones',
          table: 'Tabla6',
          expectedHeaders: ['ID', 'Fecha'],
          candidates: [
            {
              sheet: 'inversiones',
              table: 'Tabla6',
              rowNumber: 4,
              score: 1,
              confidence: 'alta',
              headersFound: ['ID', 'Fecha'],
              headersMissing: [],
              columnsDetected: [1, 2],
              nonEmptyCells: 12,
              sampleRow: ['ID', 'Fecha'],
              followingRows: [['a'], ['b'], ['c']],
              rowTokens: ['ID', 'Fecha'],
              conflictTables: []
            }
          ],
          bestCandidate: {
            sheet: 'inversiones',
            table: 'Tabla6',
            rowNumber: 4,
            score: 1,
            confidence: 'alta',
            headersFound: ['ID', 'Fecha'],
            headersMissing: [],
            columnsDetected: [1, 2],
            nonEmptyCells: 12,
            sampleRow: ['ID', 'Fecha'],
            followingRows: [['a'], ['b'], ['c']],
            rowTokens: ['ID', 'Fecha'],
            conflictTables: []
          },
          status: 'found'
        }
      ]
    } as const;
    const markdown = buildWorkbookScanMarkdown(analysis as any);

    expect(markdown).toContain('# Scanner crudo de cabeceras del workbook');
    expect(markdown).toContain('## Resumen ejecutivo');
    expect(markdown).toContain('## Tablas no encontradas');
  });
});
