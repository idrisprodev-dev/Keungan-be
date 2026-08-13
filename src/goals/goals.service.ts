import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  // 1. CREATE: Membuat target tabungan baru
  async createGoal(data: { name: string; targetAmount: number; deadline?: Date; userId: string }) {
    try {
      const newGoal = await this.prisma.goal.create({
        data: {
          name: data.name,
          targetAmount: data.targetAmount,
          deadline: data.deadline ? new Date(data.deadline) : null,
          userId: data.userId,
        },
      });
      return { status: 'success', message: 'Target tabungan berhasil dibuat', data: newGoal };
    } catch (error) {
      return { status: 'error', message: 'Gagal membuat target tabungan' };
    }
  }

  // 2. READ (All): Mengambil semua target tabungan milik user
  async getGoalsByUser(userId: string) {
    try {
      const goals = await this.prisma.goal.findMany({
        where: { userId: userId },
        orderBy: { createdAt: 'desc' }
      });
      return { status: 'success', data: goals };
    } catch (error) {
      return { status: 'error', message: 'Gagal mengambil data tabungan' };
    }
  }

  // 3. READ (Single): Mengambil satu target tabungan secara spesifik berdasarkan ID
  async getGoalById(id: string) {
    try {
      const goal = await this.prisma.goal.findUnique({
        where: { id: id },
      });
      if (!goal) return { status: 'error', message: 'Tabungan tidak ditemukan' };
      return { status: 'success', data: goal };
    } catch (error) {
      return { status: 'error', message: 'Gagal mengambil detail tabungan' };
    }
  }

  // 4. UPDATE: Memperbarui seluruh/sebagian data tabungan (Nama, Target, Progres, Tenggat)
  async updateGoal(id: string, data: { name?: string; targetAmount?: number; currentAmount?: number; deadline?: Date }) {
    try {
      const updatedGoal = await this.prisma.goal.update({
        where: { id: id },
        data: {
          name: data.name,
          targetAmount: data.targetAmount,
          currentAmount: data.currentAmount,
          deadline: data.deadline ? new Date(data.deadline) : undefined,
        },
      });
      return { status: 'success', message: 'Data tabungan berhasil diperbarui', data: updatedGoal };
    } catch (error) {
      return { status: 'error', message: 'Gagal memperbarui tabungan. Pastikan ID valid.' };
    }
  }

  // 5. DELETE: Menghapus target tabungan
  async deleteGoal(id: string) {
    try {
      await this.prisma.goal.delete({
        where: { id: id },
      });
      return { status: 'success', message: 'Target tabungan dihapus' };
    } catch (error) {
      return { status: 'error', message: 'Gagal menghapus tabungan' };
    }
  }
}