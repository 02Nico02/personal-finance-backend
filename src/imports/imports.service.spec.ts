import { BadRequestException } from '@nestjs/common';
import { ImportsService } from './imports.service';

describe('ImportsService', () => {
  const prismaMock = {
    importBatch: {
      create: jest.fn(),
      update: jest.fn(),
    },
    importedRow: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const workbookReaderMock = {
    read: jest.fn(),
  } as { read: jest.Mock };

  let service: ImportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ImportsService(prismaMock as never, workbookReaderMock);
  });

  it('calculates a stable sha-256 checksum', () => {
    const checksum = service.calculateChecksum(Buffer.from('hola mundo'));

    expect(checksum).toBe('0b894166d3336435c800bea36ff21b29eaa801a52f584c006c49289a0dcf6e2f');
  });

  it('rejects invalid extensions', () => {
    expect(() => service.assertAllowedExtension('archivo.txt')).toThrow(BadRequestException);
  });

  it('accepts allowed excel extensions', () => {
    expect(() => service.assertAllowedExtension('archivo.xlsx')).not.toThrow();
    expect(() => service.assertAllowedExtension('archivo.xlsm')).not.toThrow();
    expect(() => service.assertAllowedExtension('archivo.xls')).not.toThrow();
  });

  it('imports workbook rows through prisma', async () => {
    const tx = {
      importedRow: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      importBatch: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    prismaMock.importBatch.create.mockResolvedValue({ id: 'batch-1' });
    prismaMock.$transaction.mockImplementation(async (callback: (trx: typeof tx) => Promise<void>) => callback(tx));
    workbookReaderMock.read.mockReturnValue({
      detectedTables: ['Tabla6'],
      warnings: [],
      sheets: [
        {
          name: 'Tabla6',
          sourceTables: ['Tabla6'],
          rows: [
            {
              sourceSheet: 'Tabla6',
              sourceTable: 'Tabla6',
              sourceRowId: '2',
              rawData: { ESPECIE: 'MSFT', TOTAL: 100 },
              normalizedData: { ESPECIE: 'MSFT', TOTAL: 100 },
              rowHash: 'hash-1',
            },
          ],
        },
      ],
    });

    const result = await service.importExcel({
      originalname: 'Historial Sueldo.xlsm',
      buffer: Buffer.from('excel'),
    } as Express.Multer.File);

    expect(prismaMock.importBatch.create).toHaveBeenCalledTimes(1);
    expect(tx.importedRow.createMany).toHaveBeenCalledTimes(1);
    expect(tx.importBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'batch-1' },
        data: expect.objectContaining({ status: 'imported' }),
      })
    );
    expect(result.status).toBe('imported');
    expect(result.rowsImported).toBe(1);
    expect(result.detectedTables).toEqual(['Tabla6']);
  });
});
