import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  // Metode ini akan otomatis berjalan saat aplikasi NestJS pertama kali dinyalakan
  async onModuleInit() {
    await this.$connect();
    console.log('Database Supabase Berhasil Terhubung!');
  }
}