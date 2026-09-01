import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { SmartRulesService } from '../smart-rules/smart-rules.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smartRulesService: SmartRulesService,
  ) {}
  private readonly logger = new Logger(TransactionsService.name);

  async findAll(userId: string) {
    // Menghapus include sheet karena sudah tidak dipakai
    return this.prisma.transaction.findMany({
      where: { userId }, include: { category: true }, orderBy: { date: 'desc' },
    });
  }

async create(userId: string, data: any) {
    let finalCategoryId = data.categoryId;

    // JIKA USER MEMILIH "BIARKAN SISTEM MEMILIH OTOMATIS" (Kategori Kosong)
    if (!finalCategoryId) {
      // 1. Cek di tabel SmartRule
      const rules = await this.prisma.smartRule.findMany({ where: { userId } });
      const matchedRule = rules.find(rule =>
        data.description.toLowerCase().includes(rule.keyword.toLowerCase())
      );

      if (matchedRule) {
        finalCategoryId = matchedRule.categoryId;
      } else {
        // 2. JIKA SMART RULE GAGAL MENEMUKAN KECOCOKAN
        // Daripada melempar error, kita cari kategori pertama milik user sebagai Default
        const defaultCategory = await this.prisma.category.findFirst({
          where: { userId, type: data.type }
        });
        
        if (defaultCategory) {
          finalCategoryId = defaultCategory.id; // Otomatis masuk ke kategori pertama
        } else {
          throw new BadRequestException('Gagal menyimpan: Anda belum memiliki kategori satupun.');
        }
      }
    }

    // Lanjut simpan ke database...
    return await this.prisma.transaction.create({
      data: {
        ...data,
        userId,
        categoryId: finalCategoryId,
      }
    });
  }
  
  async remove(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    await this.prisma.transaction.delete({ where: { id } });
    return { status: 'success', message: 'Transaksi berhasil dihapus dari sistem.' };
  }

  async update(userId: string, id: string, updateData: any) {
    // Pastikan transaksi ini benar-benar milik user tersebut
    const existing = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Transaksi tidak ditemukan.');

    try {
      const updatedTransaction = await this.prisma.transaction.update({
        where: { id },
        data: {
          amount: updateData.amount,
          type: updateData.type,
          categoryId: updateData.categoryId,
          description: updateData.description,
          date: updateData.date ? new Date(updateData.date) : undefined,
        },
      });
      return { status: 'success', message: 'Transaksi diperbarui', data: updatedTransaction };
    } catch (error) {
      throw new InternalServerErrorException('Gagal memperbarui transaksi');
    }
  }
}