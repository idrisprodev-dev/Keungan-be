    import { Injectable, NotFoundException } from '@nestjs/common';
    import { CategoryType } from '@prisma/client';
    import { PrismaService } from '../prisma/prisma.service';
    import { SheetsService } from '../sheets/sheets.service';

    @Injectable()
    export class TransactionsService {
    constructor(
      private readonly prisma: PrismaService,
      private readonly sheetsService: SheetsService,
    ) {}

    // 1. Mengambil semua transaksi berdasarkan ID Pengguna
    async getTransactionsByUser(userId: string) {
        try {
        const transactions = await this.prisma.transaction.findMany({
            where: { userId: userId },
            include: { 
            category: true // Secara otomatis menarik data dari tabel Kategori
            },
            orderBy: { date: 'desc' } // Urutkan dari yang paling baru
        });
        return { status: 'success', data: transactions };
        } catch (error) {
        return { status: 'error', message: 'Gagal mengambil data transaksi' };
        }
    }

    // 2. Mencatat transaksi baru
// 2. Mencatat transaksi baru
    async createTransaction(data: { amount: number; description?: string; userId: string; categoryId: string; type?: CategoryType }) {
        try {
            // [UPDATE]: Hapus select: { type: true } agar kita mendapat SELURUH objek kategori, 
            // karena Google Sheets butuh 'category.name'.
            const category = await this.prisma.category.findUnique({
                where: { id: data.categoryId },
            });

            if (!category) {
                return { status: 'error', message: 'Kategori tidak valid.' };
            }

            // Simpan ke database lokal
            const newTransaction = await this.prisma.transaction.create({
                data: {
                    amount: data.amount,
                    description: data.description,
                    type: data.type ?? category.type,
                    userId: data.userId,
                    categoryId: data.categoryId,
                },
            });

            // =======================================================
            // [INTEGRASI GOOGLE SHEETS] 
            // Tembak fungsi syncTransaction tepat setelah masuk ke DB
            // =======================================================
            try {
                await this.sheetsService.syncTransaction(data.userId, newTransaction, category);
            } catch (sheetError) {
                // Kita gunakan try-catch terpisah agar jika Google API sedang down, 
                // data tetap tersimpan di lokal dan tidak membuat aplikasi crash.
                console.error('Peringatan: Data tersimpan di DB lokal, namun gagal sinkron ke Spreadsheet:', sheetError);
            }

            return { status: 'success', message: 'Transaksi berhasil dicatat', data: newTransaction };
        } catch (error) {
            return { status: 'error', message: 'Gagal mencatat transaksi. Pastikan ID Pengguna dan Kategori valid.' };
        }
    }
    
    // 3. Menghapus transaksi (jika salah input)
// Tambahkan ini di bawah fungsi findAll
  async update(id: string, userId: string, updateData: any) {
    // Verifikasi kepemilikan data (agar user A tidak bisa edit data user B)
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan atau akses ditolak.');

    // Jika kategori diubah, pastikan kategori baru itu valid dan milik user
    if (updateData.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: updateData.categoryId, userId },
      });
      if (!category) throw new NotFoundException('Kategori tidak valid.');
    }

    // Eksekusi update ke database
    return this.prisma.transaction.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, userId: string) {
    // Verifikasi kepemilikan data
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan atau akses ditolak.');

    // Eksekusi hapus dari database
    return this.prisma.transaction.delete({
      where: { id },
    });
  }    }