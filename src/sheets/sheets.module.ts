import { Module } from '@nestjs/common';
import { SheetsService } from './sheets.service';
import { SheetsController } from './sheets.controller';

@Module({
  controllers: [SheetsController], // Tambahkan baris ini
  providers: [SheetsService],
  exports: [SheetsService],
})
export class SheetsModule {}