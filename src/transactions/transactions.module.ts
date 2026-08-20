import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SheetsModule } from '../sheets/sheets.module'; // WAJIB DIIMPOR
import { SmartRulesModule } from '../smart-rules/smart-rules.module';

@Module({
  imports: [PrismaModule, SheetsModule, SmartRulesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}