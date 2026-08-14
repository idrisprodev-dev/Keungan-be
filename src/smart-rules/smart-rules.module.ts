import { Module } from '@nestjs/common';
import { SmartRulesController } from './smart-rules.controller';
import { SmartRulesService } from './smart-rules.service';
import { PrismaModule } from '../prisma/prisma.module'; // Import Prisma

@Module({
  imports: [PrismaModule], // Wajib untuk akses database
  controllers: [SmartRulesController],
  providers: [SmartRulesService],
  exports: [SmartRulesService], // Ekspor agar bisa dibaca oleh Transaksi
})
export class SmartRulesModule {}