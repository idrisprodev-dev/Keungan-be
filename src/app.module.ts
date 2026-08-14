import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core'; // IMPORT INI
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { SheetsModule } from './sheets/sheets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { GoalsModule } from './goals/goals.module';
import { UsersModule } from './users/users.module';
import { WidgetsModule } from './widgets/widgets.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'; // IMPORT INI
import { SmartRulesModule } from './smart-rules/smart-rules.module';

@Module({
  imports: [
    PrismaModule, AuthModule, CategoriesModule, SheetsModule,
    SmartRulesModule, TransactionsModule, GoalsModule, UsersModule, WidgetsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // TAMBAHKAN BLOK INI UNTUK MENGUNCI SELURUH APLIKASI
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}