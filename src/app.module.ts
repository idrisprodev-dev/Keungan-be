import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { GoalsModule } from './goals/goals.module';
import { AuthModule } from './auth/auth.module';
import { SheetsModule } from './sheets/sheets.module';

@Module({
  imports: [PrismaModule, UsersModule, CategoriesModule, TransactionsModule, GoalsModule, AuthModule, SheetsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
