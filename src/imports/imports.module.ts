import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ExcelWorkbookReaderService } from './excel-workbook-reader.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ImportsController],
  providers: [ImportsService, ExcelWorkbookReaderService],
})
export class ImportsModule {}
