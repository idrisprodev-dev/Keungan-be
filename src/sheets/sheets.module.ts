import { Module } from '@nestjs/common';
import { SheetsService } from './sheets.service';
import { PrismaService } from '../prisma/prisma.service'; // Impor manual Prisma

@Module({
  providers: [SheetsService, PrismaService],
  exports: [SheetsService], // EKSPOR MUTLAK agar bisa diakses modul lain
})
export class SheetsModule {}