import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportsService } from './imports.service';
import { ImportExcelResponseDto } from './dto/import-excel-response.dto';

const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('excel')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_UPLOAD_SIZE_BYTES
      }
    })
  )
  async importExcel(@UploadedFile() file?: Express.Multer.File): Promise<ImportExcelResponseDto> {
    if (!file) {
      throw new BadRequestException('Debes enviar un archivo Excel en el campo file.');
    }

    return this.importsService.importExcel(file);
  }
}
