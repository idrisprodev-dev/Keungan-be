import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WidgetsService {
  constructor(private prisma: PrismaService) {}

  // 1. Ambil preferensi widget milik user
  async getPreferences(userId: string) {
    try {
      return await this.prisma.widgetPreference.findMany({
        where: { userId },
        orderBy: { orderIndex: 'asc' }, // Urutkan berdasarkan index dari terkecil ke terbesar
      });
    } catch (error) {
      throw new InternalServerErrorException('Gagal mengambil preferensi widget.');
    }
  }

  // 2. Simpan atau perbarui preferensi massal (Upsert)
  async updatePreferences(userId: string, widgets: { widgetName: string; isVisible: boolean; orderIndex: number }[]) {
    try {
      // Kita menggunakan $transaction agar jika 1 gagal, semua dibatalkan (konsistensi data)
      const upsertPromises = widgets.map(widget => 
        this.prisma.widgetPreference.upsert({
          where: {
            userId_widgetName: { userId, widgetName: widget.widgetName } // Berdasarkan constraint unique di skema
          },
          update: {
            isVisible: widget.isVisible,
            orderIndex: widget.orderIndex,
          },
          create: {
            userId,
            widgetName: widget.widgetName,
            isVisible: widget.isVisible,
            orderIndex: widget.orderIndex,
          }
        })
      );

      await this.prisma.$transaction(upsertPromises);
      
      return { status: 'success', message: 'Preferensi widget berhasil disimpan permanen.' };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Gagal menyimpan preferensi widget.');
    }
  }
}