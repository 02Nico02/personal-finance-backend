import { compareToOfficialMap, groupRowsByTable, suggestLogicalTable } from './excel-workbook-analysis';

describe('excel-workbook-analysis', () => {
  it('suggests Tabla47 for classification headers', () => {
    expect(suggestLogicalTable('Alertas', 'Alertas#1', ['ESPECIE', 'TIPO', 'SECTOR', 'SUBSECTOR', 'REGION'])).toBe('Tabla47');
  });

  it('suggests Tabla5 for historical price headers', () => {
    expect(suggestLogicalTable('Historial Inversiones', 'Tabla5', ['FECHA', 'MES', 'ESPECIE', 'PRECIO'])).toBe('Tabla5');
  });

  it('suggests TablaPosiciones for current positions headers', () => {
    expect(
      suggestLogicalTable('inversiones', 'TablaPosiciones', [
        'ESPECIE',
        'MONEDA',
        'TIPO',
        'CANTIDAD',
        'TOTAL INV',
        'PRECIO ACT',
        'TOTAL ACTUAL',
        'RESULTADO $',
        'RESULTADO %',
        'PRECIO PROM'
      ])
    ).toBe('TablaPosiciones');
  });

  it('suggests Tabla_OrdenesPendientes for pending order headers', () => {
    expect(suggestLogicalTable('inversiones', 'Tabla_OrdenesPendientes', ['ESPECIE', 'Cant', 'PRECIO'])).toBe('Tabla_OrdenesPendientes');
  });

  it('keeps unknown tables as Desconocida', () => {
    expect(suggestLogicalTable('otra', 'otra#1', ['A', 'B', 'C'])).toBe('Desconocida');
  });

  it('builds a comparison against the official map', () => {
    const diagnostics = groupRowsByTable([
      {
        sourceSheet: 'inversiones',
        sourceTable: 'Tabla6',
        sourceRowId: '2',
        rawData: { ID: 1, Fecha: '2026-06-23', ESPECIE: 'MSFT', MONEDA: 'USD', 'CANT.': 2, 'PREC. COMP.': 100, TOTAL: 200, 'PREC. ACT.': 110, 'VALORI. ACT.': 220, VARIACION: 20, TEM: 0.1, TNA: 0.2 },
        normalizedData: { ID: 1 }
      }
    ]);

    const comparison = compareToOfficialMap(diagnostics);
    expect(comparison.find((item) => item.sheet === 'inversiones')?.expectedTables).toContain('Tabla6');
  });
});
