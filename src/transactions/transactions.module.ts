import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { SheetsModule } from '../sheets/sheets.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [SheetsModule,PrismaModule],
  providers: [TransactionsService],
  controllers: [TransactionsController]
})
export class TransactionsModule {}
