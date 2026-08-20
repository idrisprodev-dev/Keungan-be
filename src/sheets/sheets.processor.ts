// 1. Import dari bullmq, bukan bull
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service'; // Sesuaikan path jika beda
import { SheetsService } from './sheets.service';

@Processor('google-sheets-sync') // Nama antrean
export class SheetsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sheetsService: SheetsService,
  ) {
    super(); // Wajib dipanggil saat melakukan extends WorkerHost
  }

  // 2. Gunakan method bawaan "process", bukan dekorator @Process
  async process(job: Job): Promise<any> {
    // Jika dalam satu queue ada beberapa jenis job, kita bisa filter dari nama job-nya
    if (job.name === 'sync-transaction') {
      const { transactionId, userId } = job.data;
      console.log(`[BullMQ] ⏳ Memproses transaksi ${transactionId} untuk user ${userId}...`);

      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { googleRefreshToken: true }, 
        });

        if (!user?.googleRefreshToken) {
          throw new Error('Refresh token tidak ada. User harus login ulang via Google.');
        }

        const transaction = await this.prisma.transaction.findUnique({
          where: { id: transactionId },
          include: { 
            category: true,
            sheet: true // <--- Tambahkan relasi ini
          },
        });

        if (!transaction) {
          throw new Error('Transaksi tidak ditemukan di database Prisma.');
        }

       // 3. Format data ke dalam array sesuai urutan kolom (A, B, C, D, E)
    if (!transaction.sheet?.spreadsheetId) {
      throw new Error(`Transaksi ${transaction.id} tidak memiliki relasi sheet yang valid.`);
    }

    const rowData = [
      transaction.date.toISOString(),
      transaction.type,
      transaction.category?.name || 'Tanpa Kategori',
      transaction.description,
      transaction.amount,
    ];

    // 4. Eksekusi pengiriman data
    await this.sheetsService.appendTransactionRow(
      user.googleRefreshToken,
      transaction.sheet.spreadsheetId, // <--- Gunakan ini, bukan user.sheetId
      rowData,
    );

        console.log(`[BullMQ] ✅ Transaksi ${transactionId} sukses mendarat di Sheets!`);
      } catch (error) {
        if (error instanceof Error) {
          console.error(`[BullMQ] ❌ Gagal memproses job ${job.id}:`, error.stack);
        } else {
          console.error(`[BullMQ] ❌ Gagal memproses job ${job.id} dengan error tidak diketahui:`, error);
        }
        throw error; 
      }
    }
  }
}