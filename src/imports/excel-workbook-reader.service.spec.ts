import * as XLSX from 'xlsx';
import { ExcelWorkbookReaderService } from './excel-workbook-reader.service';

describe('ExcelWorkbookReaderService', () => {
  let service: ExcelWorkbookReaderService;

  beforeEach(() => {
    service = new ExcelWorkbookReaderService();
  });

  it('converts a workbook sheet into imported rows', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['ID', 'Fecha', 'ESPECIE', 'MONEDA', 'CANT.', 'PREC. COMP.', 'TOTAL', 'PREC. ACT.', 'VALORI. ACT.'],
      [1, '2026-06-23', 'MSFT', 'USD', 2, 100, 200, 110, 220],
    ]);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inversiones');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const document = service.read(buffer);

    expect(document.sheetNames).toContain('Inversiones');
    expect(document.detectedTables).toContain('Tabla6');
    expect(document.sheets).toHaveLength(1);
    expect(document.sheets[0].rows).toHaveLength(1);
    expect(document.sheets[0].rows[0]).toMatchObject({
      sourceSheet: 'Inversiones',
      sourceTable: 'Tabla6',
      rawData: expect.objectContaining({
        ESPECIE: 'MSFT',
        TOTAL: 200,
      }),
    });
  });
});
