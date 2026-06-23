import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

describe('ImportsController', () => {
  let controller: ImportsController;
  const importsServiceMock = {
    importExcel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        {
          provide: ImportsService,
          useValue: importsServiceMock,
        },
      ],
    }).compile();

    controller = module.get(ImportsController);
    importsServiceMock.importExcel.mockReset();
  });

  it('rejects requests without file', async () => {
    await expect(controller.importExcel(undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.importExcel(undefined)).rejects.toThrow('Debes enviar un archivo Excel en el campo file.');
  });
});
