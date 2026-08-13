    import { Injectable } from '@nestjs/common';
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
    async createTransaction(data: { amount: number; description?: string; userId: string; categoryId: string; type?: CategoryType }) {
        try {
        const category = await this.prisma.category.findUnique({
            where: { id: data.categoryId },
            select: { type: true },
        });

        if (!category) {
            return { status: 'error', message: 'Kategori tidak valid.' };
        }

        const newTransaction = await this.prisma.transaction.create({
            data: {
            amount: data.amount,
            description: data.description,
            type: data.type ?? category.type,
            userId: data.userId,
            categoryId: data.categoryId,
            },
        });
        return { status: 'success', message: 'Transaksi berhasil dicatat', data: newTransaction };
        } catch (error) {
        return { status: 'error', message: 'Gagal mencatat transaksi. Pastikan ID Pengguna dan Kategori valid.' };
        }
    }

    // 3. Menghapus transaksi (jika salah input)
    async deleteTransaction(id: string) {
        try {
        await this.prisma.transaction.delete({
            where: { id: id },
        });
        return { status: 'success', message: 'Transaksi berhasil dihapus' };
        } catch (error) {
        return { status: 'error', message: 'Gagal menghapus transaksi' };
        }
    }
    async updateTransaction(id: string, data: { amount?: number; description?: string; categoryId?: string; type?: CategoryType }) {
    try {
      let type = data.type;

      if (data.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: data.categoryId },
          select: { type: true },
        });

        if (!category) {
          return { status: 'error', message: 'Kategori tidak valid.' };
        }

        type = type ?? category.type;
      }

      const updatedTransaction = await this.prisma.transaction.update({
        where: { id: id },
        data: {
          amount: data.amount,
          description: data.description,
          categoryId: data.categoryId,
          ...(type !== undefined ? { type } : {}),
        },
      });
      return { status: 'success', message: 'Transaksi berhasil diperbarui', data: updatedTransaction };
    } catch (error) {
      return { status: 'error', message: 'Gagal memperbarui transaksi. Pastikan ID valid.' };
    }
  }
    }