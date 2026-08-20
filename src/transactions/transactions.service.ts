import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SheetsService } from '../sheets/sheets.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { SmartRulesService } from '../smart-rules/smart-rules.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sheetsService: SheetsService,
    private readonly smartRulesService: SmartRulesService, // <- Inject di sini
  ) {}
  private readonly logger = new Logger(TransactionsService.name);

  async findAll(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId }, include: { category: true, sheet: true }, orderBy: { date: 'desc' },
    });
  }

async create(userId: string, createTransactionDto: CreateTransactionDto) {
    try {
      // Evaluasi otomatis jika categoryId tidak disertakan oleh frontend
      let resolvedCategoryId = createTransactionDto.categoryId;

      if (!resolvedCategoryId) {
        const matchedRule = await this.smartRulesService.evaluateTransaction(
          userId,
          createTransactionDto.description || '',
        );

        if (matchedRule) {
          resolvedCategoryId = matchedRule.categoryId;
        }
      }

      // Jika setelah evaluasi kategori masih kosong, lempar error.
      if (!resolvedCategoryId) {
        throw new BadRequestException('Kategori wajib diisi atau tidak ada Smart Rule yang cocok.');
      }
      // Cari koneksi sheet utama milik user
      const primarySheet = await this.prisma.sheetConnection.findFirst({
        where: { userId, isPrimary: true },
      });

      if (!primarySheet) {
        throw new BadRequestException('Tidak ada koneksi Google Sheet utama yang ditemukan. Harap hubungkan terlebih dahulu.');
      }

      // 1. Simpan ke database
      const newTransaction = await this.prisma.transaction.create({
        data: {
          userId,
          sheetId: primarySheet.id, // WAJIB ADA
          categoryId: resolvedCategoryId, // WAJIB ADA
          amount: createTransactionDto.amount,
          type: createTransactionDto.type,
          description: createTransactionDto.description || '',
          // Default ke hari ini jika tidak dikirim dari frontend
          date: createTransactionDto.date ? new Date(createTransactionDto.date) : new Date(),
        },
      });

      // 2. Kirim ke antrean background (Redis/BullMQ)
      try {
        await this.sheetsService.queueSyncTransaction(userId, newTransaction);
      } catch (queueError) {
        this.logger.error(`Gagal antre sync Sheets untuk transaksi ${newTransaction.id}`);
      }

      // 3. Return sukses ke frontend
      return {
        success: true,
        message: 'Transaksi berhasil disimpan',
        data: newTransaction,
      };

    } catch (error) {
      // Cek apakah error adalah instance dari Error untuk bisa akses .stack
      if (error instanceof Error) {
        this.logger.error(`Gagal membuat transaksi untuk user ${userId}`, error.stack);
      } else {
        this.logger.error(`Gagal membuat transaksi untuk user ${userId}`, error);
      }
      throw new InternalServerErrorException('Gagal menyimpan transaksi ke database');
    }
  }
  async remove(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.');
    await this.prisma.transaction.delete({ where: { id } });
    return { status: 'success', message: 'Transaksi berhasil dihapus dari sistem.' };
  }
}