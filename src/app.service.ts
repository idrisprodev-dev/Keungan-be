import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  async checkDatabaseStatus() {
    try {
      const userCount = await this.prisma.user.count();
      return {
        status: 'success',
        message: 'Backend NestJS Aktif',
        database_connected: true,
        total_users_in_db: userCount,
      };
    } catch (error) {
      // PERBAIKAN: Memeriksa tipe data error secara eksplisit
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui';
      
      return {
        status: 'error',
        message: 'Gagal terhubung ke database',
        error_detail: errorMessage,
      };
    }
  }
}