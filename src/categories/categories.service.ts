    import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
    import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

    @Injectable()
    export class CategoriesService {
    constructor(private prisma: PrismaService) {}

    // 1. Mengambil semua kategori berdasarkan ID Pengguna
    async getCategoriesByUser(userId: string) {
        try {
        const categories = await this.prisma.category.findMany({
            where: { userId: userId },
        });
        return { status: 'success', data: categories };
        } catch (error) {
        return { status: 'error', message: 'Gagal mengambil kategori' };
        }
    }

    // 2. Membuat kategori baru
    async createCategory(data: { name: string; type: 'INCOME' | 'EXPENSE'; userId: string }) {
        try {
        const newCategory = await this.prisma.category.create({
            data: {
            name: data.name,
            type: data.type,
            userId: data.userId, // ID user yang memiliki kategori ini
            },
        });
        return { status: 'success', message: 'Kategori berhasil dibuat', data: newCategory };
        } catch (error) {
        return { status: 'error', message: 'Gagal membuat kategori. Pastikan userId valid.' };
        }
    }

    // 3. Menghapus kategori
    async deleteCategory(id: string) {
        try {
        await this.prisma.category.delete({
            where: { id: id },
        });
        return { status: 'success', message: 'Kategori berhasil dihapus' };
        } catch (error) {
        return { status: 'error', message: 'Gagal menghapus kategori' };
        }
    }
        async updateCategory(id: string, data: { name?: string; type?: 'INCOME' | 'EXPENSE' }) {
        try {
        const updatedCategory = await this.prisma.category.update({
            where: { id: id },
            data: {
            name: data.name,
            type: data.type,
            },
        });
        return { status: 'success', message: 'Kategori berhasil diperbarui', data: updatedCategory };
        } catch (error) {
        return { status: 'error', message: 'Gagal memperbarui kategori. Pastikan ID valid.' };
        }
    }
    // Injeksi Massal Kategori (Batch Insert)
  async createBatch(createCategoryDtos: CreateCategoryDto[], userId: string) {
    // Memetakan DTO yang masuk untuk menyertakan userId ke masing-masing objek
    const categoriesData = createCategoryDtos.map(dto => ({
      ...dto,
      userId,
    }));

    // Mengeksekusi injeksi massal ke database PostgreSQL via Prisma
    const result = await this.prisma.category.createMany({
      data: categoriesData,
      skipDuplicates: true, // Mencegah galat jika kategori dengan nama yang sama sudah ada
    });

    return {
      message: `${result.count} kategori klasifikasi berhasil diinisiasi.`,
      count: result.count
    };
  }
  async remove(id: string, userId: string) {
    // 1. Lakukan inspeksi keberadaan data
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
    });

    if (!category) {
      // Pastikan Anda sudah mengimpor NotFoundException dari @nestjs/common
      throw new NotFoundException('Kategori tidak ditemukan atau Anda tidak memiliki akses.');
    }

    // 2. Blokir jika ini adalah kategori bawaan sistem
    if (category.isDefault) {
      // Pastikan Anda sudah mengimpor BadRequestException dari @nestjs/common
      throw new BadRequestException('Otorisasi ditolak: Kategori bawaan sistem tidak dapat dihapus.');
    }

    // 3. Eksekusi penghapusan jika lolos validasi
    return this.prisma.category.delete({
      where: { id },
    });
  }

  // Pastikan Anda mengimpor UpdateCategoryDto di atas
  async update(id: string, updateCategoryDto: UpdateCategoryDto, userId: string) {
    // 1. Verifikasi keberadaan dan kepemilikan kategori
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
    });

    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan atau Anda tidak memiliki otorisasi.');
    }

    // 2. Eksekusi pemutakhiran data (nama, warna, ikon, dll)
    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
  }
    }