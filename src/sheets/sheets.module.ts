import { Module } from '@nestjs/common';
import { SheetsService } from './sheets.service';
import { SheetsController } from './sheets.controller';
import { BullModule } from '@nestjs/bullmq';
import { SheetsProcessor } from './sheets.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'google-sheets-sync',
    }),
  ],
  controllers: [SheetsController], // Tambahkan baris ini
  providers: [SheetsService, SheetsProcessor],
  exports: [SheetsService],
})
export class SheetsModule {}