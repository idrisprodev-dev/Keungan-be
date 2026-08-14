import { 
  Injectable, 
  InternalServerErrorException, 
  NotFoundException 
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryType } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // 1. Dapatkan semua kategori milik User (Dipanggil oleh Controller.findAll)
  async findAll(userId: string) {
    try {
      const categories = await this.prisma.category.findMany({
        where: { userId: userId },
        orderBy: { createdAt: 'asc' },
      });
      return { status: 'success', data: categories };
    } catch (error) {
      throw new InternalServerErrorException('Gagal mengambil data kategori.');
    }
  }

  // 2. Injeksi Massal (Batch) dipanggil oleh Controller.createBatch (Onboarding)
  async createBatch(userId: string, categoriesArray: any[]) {
    try {
      const dataToInsert = categoriesArray.map((cat) => ({
        userId,
        name: cat.name,
        // Konversi tipe dari string FE ke Enum Prisma (Default: EXPENSE)
        type: cat.type === 'INCOME' ? CategoryType.INCOME : CategoryType.EXPENSE,
        icon: cat.icon || null,
        color: cat.color || null,
      }));

      const result = await this.prisma.category.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });

      return { 
        status: 'success',
        message: `${result.count} kategori berhasil disimpan.`, 
        count: result.count 
      };
    } catch (error: any) {
      console.error('[CategoriesService Error]:', error.message);
      throw new InternalServerErrorException('Gagal menyimpan kategori secara massal.');
    }
  }

  // 3. Buat satu kategori tunggal (Untuk fitur tambah kategori di Dashboard)
  async createCategory(data: { name: string; type: 'INCOME' | 'EXPENSE'; userId: string }) {
    try {
      const newCategory = await this.prisma.category.create({
        data: {
          name: data.name,
          type: data.type,
          userId: data.userId,
        },
      });
      return { status: 'success', message: 'Kategori berhasil dibuat', data: newCategory };
    } catch (error) {
      throw new InternalServerErrorException('Gagal membuat kategori tunggal.');
    }
  }

  // 4. Update Kategori (Validasi kepemilikan)
  async updateCategory(id: string, userId: string, data: { name?: string; type?: 'INCOME' | 'EXPENSE'; icon?: string; color?: string }) {
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan atau Anda tidak memiliki akses.');
    }

    try {
      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: {
          name: data.name,
          type: data.type,
          icon: data.icon,
          color: data.color,
        },
      });
      return { status: 'success', message: 'Kategori berhasil diperbarui', data: updatedCategory };
    } catch (error) {
      throw new InternalServerErrorException('Gagal memperbarui kategori.');
    }
  }

  // 5. Hapus Kategori (Dipanggil oleh Controller.remove)
  async remove(userId: string, id: string) {
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan atau Anda tidak memiliki akses.');
    }

    try {
      await this.prisma.category.delete({ where: { id } });
      return { status: 'success', message: 'Kategori berhasil dihapus' };
    } catch (error) {
      throw new InternalServerErrorException('Gagal menghapus kategori.');
    }
  }
}