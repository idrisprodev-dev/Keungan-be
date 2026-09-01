import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
          category: true, // Hanya sertakan detail kategori
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      throw new InternalServerErrorException('Gagal mengambil daftar Smart Rules.');
    }
  }

  // 2. Buat aturan pintar baru
async create(userId: string, data: any) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true }
  });

  if (!user) {
    throw new NotFoundException('User tidak ditemukan.');
  }

  const totalRules = await this.prisma.smartRule.count({
    where: { userId: userId }
  });

  if (user.plan === 'FREE') {
    // Logika jika Free Trial habis bisa ditaruh di sini
  }
  else if (user.plan === 'PRO') {
    if (totalRules >= 10) {
      throw new ForbiddenException('Batas maksimal tercapai! Paket Pro hanya bisa membuat 10 Smart Rules. Silakan upgrade ke Platinum.');
    }
  }

  return await this.prisma.smartRule.create({
    data: {
      ...data,
      userId: userId,
    }
  });
}

  
  
  // 3. Perbarui aturan pintar
  async update(userId: string, id: string, data: { keyword?: string; categoryId?: string }) {
    const rule = await this.prisma.smartRule.findFirst({ where: { id, userId } });

    if (!rule) {
      throw new NotFoundException('Smart Rule tidak ditemukan atau Anda tidak memiliki akses.');
    }

    if (data.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: data.categoryId, userId }
      });

      if (!category) {
        throw new BadRequestException('Kategori tidak valid atau tidak ditemukan.');
      }
    }

    try {
      const updatedRule = await this.prisma.smartRule.update({
        where: { id },
        data: {
          ...(data.keyword !== undefined && { keyword: data.keyword.toLowerCase() }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        }
      });
      return { status: 'success', message: 'Smart Rule berhasil diperbarui', data: updatedRule };
    } catch (error) {
      throw new InternalServerErrorException('Gagal memperbarui Smart Rule.');
    }
  }

  // 4. Hapus aturan pintar
  async remove(userId: string, id: string) {    const rule = await this.prisma.smartRule.findFirst({ where: { id, userId } });
    
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

  /**
   * Mengevaluasi deskripsi transaksi user berdasarkan aturan pintar (Smart Rules) yang mereka miliki
   */
  async evaluateTransaction(userId: string, description: string) {
    if (!description) return null;

    // 1. Ambil semua aturan (rules) milik user dari database
    const rules = await this.prisma.smartRule.findMany({
      where: { userId },
      // Diurutkan berdasarkan yang terbaru agar aturan baru lebih prioritas
      orderBy: { createdAt: 'desc' },
    });

    // 2. Loop rules untuk mencari kecocokan kata (keyword matching)
    for (const rule of rules) {
      // Mengubah ke huruf kecil agar pencocokan bersifat case-insensitive
      const isMatch = description.toLowerCase().includes(rule.keyword.toLowerCase());

      if (isMatch) {
        // Jika cocok, kembalikan data kategori yang terikat pada rule ini
        return {
          categoryId: rule.categoryId,
        };
      }
    }

    // Jika tidak ada aturan yang cocok, kembalikan null (biarkan user mengisi manual)
    return null;
  }
}