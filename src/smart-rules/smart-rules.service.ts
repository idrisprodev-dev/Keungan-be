import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SmartRulesService {
  constructor(private prisma: PrismaService) {}

  // 1. Ambil semua aturan pintar milik User
  async findAll(userId: string) {
    try {
      return await this.prisma.smartRule.findMany({
        where: { userId },
        include: { 
          category: true, // Sertakan detail kategori
          sheet: true     // Sertakan info target sheet
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      throw new InternalServerErrorException('Gagal mengambil daftar Smart Rules.');
    }
  }

  // 2. Buat aturan pintar baru
  async create(userId: string, data: { keyword: string; categoryId: string; targetSheetId?: string }) {
    // Validasi: Pastikan Kategori yang dituju benar-benar milik User ini
    const category = await this.prisma.category.findFirst({
      where: { id: data.categoryId, userId }
    });

    if (!category) {
      throw new BadRequestException('Kategori tidak valid atau tidak ditemukan.');
    }

    try {
      const newRule = await this.prisma.smartRule.create({
        data: {
          userId,
          keyword: data.keyword.toLowerCase(), // Normalisasi keyword menjadi huruf kecil
          categoryId: data.categoryId,
          targetSheetId: data.targetSheetId || null,
        }
      });
      return { status: 'success', message: 'Smart Rule berhasil dibuat', data: newRule };
    } catch (error) {
      throw new InternalServerErrorException('Gagal membuat Smart Rule.');
    }
  }

  // 3. Hapus aturan pintar
  async remove(userId: string, id: string) {
    const rule = await this.prisma.smartRule.findFirst({ where: { id, userId } });
    
    if (!rule) {
      throw new NotFoundException('Smart Rule tidak ditemukan atau Anda tidak memiliki akses.');
    }

    try {
      await this.prisma.smartRule.delete({ where: { id } });
      return { status: 'success', message: 'Smart Rule berhasil dihapus' };
    } catch (error) {
      throw new InternalServerErrorException('Gagal menghapus Smart Rule.');
    }
  }
}