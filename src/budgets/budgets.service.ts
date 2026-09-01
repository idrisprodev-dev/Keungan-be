// budgets.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBudgetDto } from './dto/create-budget.dto';

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, month: number, year: number) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, month, year },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });

    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget) => {
        const startDate = new Date(year, month - 1, 1);
        const endDate   = new Date(year, month, 0, 23, 59, 59, 999);

        const transactions = await this.prisma.transaction.findMany({
          where: {
            userId,
            categoryId: budget.categoryId,
            type: 'EXPENSE',
            date: { gte: startDate, lte: endDate },
          },
        });

        const spent = transactions.reduce((sum, t) => sum + t.amount, 0);

        return {
          ...budget,
          spent,
          remaining:  budget.amount - spent,
          percentage: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
        };
      }),
    );

    return budgetsWithSpent;
  }

async upsert(
    userId: string,
    data: { categoryId: string; amount: number; month: number; year: number },
  ) {
    const month  = parseInt(String(data.month),  10);
    const year   = parseInt(String(data.year),   10);
    const amount = parseFloat(String(data.amount));

    if (isNaN(month) || isNaN(year) || isNaN(amount)) {
      throw new BadRequestException('month, year, dan amount harus berupa angka valid');
    }

   // 1. Ambil data plan user dari database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    // 🔴 PASANG CCTV DI SINI:
    console.log("🔍 CEK PLAN USER DI DATABASE:", user?.plan);

    const existingBudget = await this.prisma.budget.findUnique({
      where: {
        userId_categoryId_month_year: { userId, categoryId: data.categoryId, month, year },
      },
    });

    // Gunakan .toUpperCase() agar aman dari salah ketik 'Pro' vs 'PRO' di database
    if (!existingBudget && user?.plan?.toUpperCase() === 'PRO') {
      const currentBudgetsCount = await this.prisma.budget.count({
        where: { userId, month, year },
      });

      // 🔴 PASANG CCTV KEDUA:
      console.log(`📊 TOTAL ANGGARAN BULAN INI: ${currentBudgetsCount}`);

      if (currentBudgetsCount >= 10) {
        console.log("🛑 BLOKIR DIAKTIFKAN: Limit Pro tercapai!");
        throw new BadRequestException(
          'Batas maksimal 10 Kategori Anggaran untuk Paket Pro pada bulan ini telah tercapai. Upgrade ke Platinum untuk menambah tanpa batas!'
        );
      }
    }
    try {
      return await this.prisma.budget.upsert({
        where: {
          userId_categoryId_month_year: {
            userId,
            categoryId: data.categoryId,
            month,
            year,
          },
        },
        update: { amount },
        create: {
          userId,
          categoryId: data.categoryId,
          amount,
          month,
          year,
        },
      });
    } catch (error: any) {
      console.log('💥 ERROR DATABASE ASLI:', error.code, error.message);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(error.message || 'Error Database Misterius');
    }
  }



  async remove(userId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Anggaran tidak ditemukan');
    return this.prisma.budget.delete({ where: { id } });
  }

async update(id: string, userId: string, dto: UpdateBudgetDto) {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Budget tidak ditemukan');

    // Jika kategori diubah, cek apakah sudah ada budget untuk kategori baru tersebut di bulan/tahun yang sama
    if (dto.categoryId && dto.categoryId !== budget.categoryId) {
      const existing = await this.prisma.budget.findFirst({
        where: {
          userId,
          categoryId: dto.categoryId,
          month: budget.month,
          year: budget.year,
        },
      });

      if (existing) {
        throw new BadRequestException('Anggaran untuk kategori tersebut pada bulan ini sudah ada.');
      }
    }

    return this.prisma.budget.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: { category: true },
    });
  }}