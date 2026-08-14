import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SheetsService } from '../sheets/sheets.service';
import { CategoryType } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService, private sheetsService: SheetsService) {}

  async findAll(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId }, include: { category: true, sheet: true }, orderBy: { date: 'desc' },
    });
  }

async create(userId: string, data: { amount: number; categoryId?: string; targetSheetId?: string; description?: string; paymentMethod?: string; date?: string; type?: 'INCOME'|'EXPENSE' }) {
    
    let finalCategoryId = data.categoryId;
    let finalTargetSheetId = data.targetSheetId;

    // ==========================================
    // 🧠 SMART RULES ENGINE (AUTO-KATEGORISASI)
    // ==========================================
    if (!finalCategoryId && data.description) {
      const descLower = data.description.toLowerCase();
      
      // Tarik semua aturan milik user
      const rules = await this.prisma.smartRule.findMany({ where: { userId } });
      
      // Pindai kecocokan kata kunci
      const matchedRule = rules.find(rule => descLower.includes(rule.keyword));

      if (matchedRule) {
        finalCategoryId = matchedRule.categoryId;
        // Jika aturan tersebut juga memerintahkan pindah Sheet, timpa sheet tujuannya
        if (matchedRule.targetSheetId) {
          finalTargetSheetId = matchedRule.targetSheetId;
        }
      }
    }

    // Validasi Kategori Final
    if (!finalCategoryId) {
      throw new BadRequestException('Kategori wajib diisi atau tidak ada Smart Rule yang cocok dengan deskripsi ini.');
    }

    const category = await this.prisma.category.findFirst({ where: { id: finalCategoryId, userId } });
    if (!category) throw new BadRequestException('Kategori tidak valid.');

    // ==========================================
    // 🔀 MULTI-SHEET ROUTING
    // ==========================================
    let targetSheet;
    if (finalTargetSheetId) {
      targetSheet = await this.prisma.sheetConnection.findFirst({ where: { id: finalTargetSheetId, userId } });
      if (!targetSheet) throw new BadRequestException('Koneksi Google Sheets tujuan tidak valid.');
    } else {
      targetSheet = await this.prisma.sheetConnection.findFirst({ where: { userId, isPrimary: true } });
      if (!targetSheet) throw new BadRequestException('Anda belum menghubungkan Google Sheets.');
    }

    try {
      // Simpan ke Database
      const newTransaction = await this.prisma.transaction.create({
        data: {
          userId,
          sheetId: targetSheet.id,
          categoryId: category.id,
          amount: data.amount,
          type: data.type ? (data.type as CategoryType) : category.type,
          date: data.date ? new Date(data.date) : new Date(),
          description: data.description || category.name,
          paymentMethod: data.paymentMethod || 'Cash',
          source: 'WEB', // Nantinya bisa diubah jadi 'AUTO' jika masuk via sistem lain
        },
      });

      // Tembak ke Google Sheets
      this.sheetsService.syncTransaction(userId, targetSheet.spreadsheetId, newTransaction, category)
        .catch(err => console.error('[Sinkronisasi Gagal]:', err.message));

      return { status: 'success', message: 'Transaksi berhasil dicatat & dikategorikan.', data: newTransaction };
    } catch (error) {
      throw new InternalServerErrorException('Gagal menyimpan transaksi.');
    }
  }
  async remove(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    await this.prisma.transaction.delete({ where: { id } });
    return { status: 'success', message: 'Transaksi berhasil dihapus dari sistem.' };
  }
}