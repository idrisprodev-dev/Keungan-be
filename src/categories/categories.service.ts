import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryType } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    try {
      const categories = await this.prisma.category.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      return { status: 'success', data: categories };
    } catch (error) {
      throw new InternalServerErrorException('Gagal mengambil data kategori.');
    }
  }

  async createCategory(userId: string, dto: CreateCategoryDto) {
    try {
      const newCategory = await this.prisma.category.create({
        data: { ...dto, userId },
      });
      return { status: 'success', message: 'Kategori berhasil dibuat', data: newCategory };
    } catch (error) {
      throw new InternalServerErrorException('Gagal membuat kategori.');
    }
  }

  async createBatch(userId: string, categories: any[]) {
    try {
      const dataToInsert = categories.map((cat) => ({
        userId,
        name: cat.name,
        type: cat.type === 'INCOME' ? CategoryType.INCOME : CategoryType.EXPENSE,
        icon: cat.icon || null,
        color: cat.color || null,
      }));

      const result = await this.prisma.category.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });

      return { status: 'success', message: `${result.count} kategori berhasil disimpan.`, count: result.count };
    } catch (error: any) {
      throw new InternalServerErrorException('Gagal menyimpan kategori massal.');
    }
  }

  async updateCategory(id: string, userId: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan atau akses ditolak.');
    }

    try {
      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: dto,
      });
      return { status: 'success', message: 'Kategori diperbarui', data: updatedCategory };
    } catch (error) {
      throw new InternalServerErrorException('Gagal memperbarui kategori.');
    }
  }

  async remove(userId: string, id: string) {
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan atau akses ditolak.');
    }

    try {
      await this.prisma.category.delete({ where: { id } });
      return { status: 'success', message: 'Kategori dihapus' };
    } catch (error) {
      throw new InternalServerErrorException('Gagal menghapus kategori.');
    }
  }
}