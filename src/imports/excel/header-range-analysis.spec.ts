import { normalizeHeaderText, scoreRowAgainstTable } from './header-range-analysis';

describe('header-range-analysis', () => {
  it('suggests Tabla6 when headers appear in values', () => {
    const candidate = scoreRowAgainstTable(
      {
        id: '1',
        importBatchId: 'batch',
        sourceSheet: 'inversiones',
        sourceTable: 'inversiones#1',
        sourceRowId: '2',
        rawData: {
          col_1: 'ID',
          col_2: 'Fecha',
          col_3: 'ESPECIE',
          col_4: 'MONEDA',
          col_5: 'CANT.',
          col_6: 'PREC. COMP.',
          col_7: 'TOTAL',
          col_8: 'PREC. ACT.',
          col_9: 'VALORI. ACT.',
          col_10: 'VARIACION',
          col_11: 'TEM',
          col_12: 'TNA'
        },
        normalizedData: null
      },
      'Tabla6'
    );

    expect(candidate.score).toBeGreaterThanOrEqual(0.7);
    expect(candidate.confidence).toBe('alta');
    expect(candidate.matchedFromValues).toContain('ESPECIE');
  });

  it('suggests TablaPosiciones when headers appear in values', () => {
    const candidate = scoreRowAgainstTable(
      {
        id: '1',
        importBatchId: 'batch',
        sourceSheet: 'inversiones',
        sourceTable: 'inversiones#1',
        sourceRowId: '2',
        rawData: {
          col_1: 'ESPECIE',
          col_2: 'MONEDA',
          col_3: 'TIPO',
          col_4: 'CANTIDAD',
          col_5: 'TOTAL INV',
          col_6: 'PRECIO ACT',
          col_7: 'TOTAL ACTUAL',
          col_8: 'RESULTADO $',
          col_9: 'RESULTADO %',
          col_10: 'PRECIO PROM'
        },
        normalizedData: null
      },
      'TablaPosiciones'
    );

    expect(candidate.score).toBeGreaterThanOrEqual(0.7);
    expect(candidate.confidence).toBe('alta');
  });

  it('suggests Tabla47 when headers appear in keys', () => {
    const candidate = scoreRowAgainstTable(
      {
        id: '1',
        importBatchId: 'batch',
        sourceSheet: 'Alertas',
        sourceTable: 'Tabla47',
        sourceRowId: '2',
        rawData: {
          ESPECIE: 'BTC',
          TIPO: 'Cripto',
          SECTOR: 'Criptomonedas',
          SUBSECTOR: 'Bitcoin',
          REGION: 'Global',
          'VALORI. ACT.': 155,
          Monto: 10,
          Esperado: 20
        },
        normalizedData: null
      },
      'Tabla47'
    );

    expect(candidate.score).toBeGreaterThanOrEqual(0.7);
    expect(candidate.matchedFromKeys).toContain('ESPECIE');
    expect(candidate.confidence).toBe('alta');
  });

  it('keeps poor matches as discard', () => {
    const candidate = scoreRowAgainstTable(
      {
        id: '1',
        importBatchId: 'batch',
        sourceSheet: 'otra',
        sourceTable: 'otra#1',
        sourceRowId: '2',
        rawData: {
          A: 'foo',
          B: 'bar',
          C: 'baz'
        },
        normalizedData: null
      },
      'Tabla6'
    );

    expect(candidate.score).toBe(0);
    expect(candidate.confidence).toBe('descartar');
  });

  it('normalizes accents and case', () => {
    expect(normalizeHeaderText('  Variación %  ')).toBe('VARIACION%');
    expect(normalizeHeaderText('fecha vent.')).toBe('FECHAVENT.');
  });
});
