import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Sesuaikan path

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getMonthlySummary(userId: string) {
    // Dapatkan tanggal awal dan akhir untuk bulan ini
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Gunakan fitur groupBy Prisma untuk menghitung total berdasarkan 'type'
    const aggregations = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId: userId, // Pastikan ada field userId di tabel Transaction milikmu
        date: {
          gte: firstDay,
          lte: lastDay,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Format hasil kembalian agar mudah dibaca oleh frontend Next.js
    let totalIncome = 0;
    let totalExpense = 0;

    aggregations.forEach((group) => {
      if (group.type === 'INCOME') {
        totalIncome = group._sum.amount || 0;
      } else if (group.type === 'EXPENSE') {
        totalExpense = group._sum.amount || 0;
      }
    });

    return {
      month: now.toLocaleString('id-ID', { month: 'long', year: 'numeric' }),
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }
}