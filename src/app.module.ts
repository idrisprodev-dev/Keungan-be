import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core'; // IMPORT INI
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { GoalsModule } from './goals/goals.module';
import { UsersModule } from './users/users.module';
import { WidgetsModule } from './widgets/widgets.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'; // IMPORT INI
import { SmartRulesModule } from './smart-rules/smart-rules.module';
import { BullModule } from '@nestjs/bullmq';
import { ReportsModule } from './reports/reports.module';
import { BudgetsModule } from './budgets/budgets.module';
import { WhatsappService } from './whatsapp/whatsapp.service';

import { WhatsappModule } from './whatsapp/whatsapp.module';
import { DevModule } from './dev/dev.module';

@Module({
  imports: [
    CacheModule.registerAsync({
      // isGlobal: true membuat fungsi cache ini bisa dipakai di seluruh file tanpa harus di-import berulang kali
      isGlobal: true,
      useFactory: async () => ({
        // Mengubah storage default menjadi Redis
        store: await redisStore({
          socket: {
            // Mengambil konfigurasi dari file .env agar aman, fallback ke localhost jika tidak ada
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
          },
        }),
      }),
    }),
   // 1. Konfigurasi Global BullMQ
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
        // Konfigurasi wajib untuk menangani enkripsi TLS pada Upstash (rediss://)
        tls: {
          rejectUnauthorized: false,
        },
      },
   }),
    PrismaModule, AuthModule, CategoriesModule, 
    SmartRulesModule, TransactionsModule, GoalsModule, UsersModule, WidgetsModule,
    ReportsModule,
    BudgetsModule,
    WhatsappModule, // <--- 2. TAMBAHKAN BARIS INI // <--- Tambahkan baris ini agar endpoint terbaca
    DevModule,

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

