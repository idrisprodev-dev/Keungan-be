import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  // 1. Buat Tabungan Baru (Dengan Limit)
  async createGoal(userId: string, data: { name: string; targetAmount: number; deadline?: string }) {
    // Validasi Limit: Maksimal 3 Tabungan per User (Khusus Paket Pro)
    const currentGoalsCount = await this.prisma.savingsGoal.count({ where: { userId } });
    
    if (currentGoalsCount >= 3) {
      throw new BadRequestException('Batas maksimal 3 Tabungan Terfokus telah tercapai. Hapus tabungan lama untuk membuat yang baru.');
    }

    try {
      const newGoal = await this.prisma.savingsGoal.create({
        data: {
          userId: userId,
          name: data.name,
          targetAmount: Number(data.targetAmount),
          deadline: data.deadline ? new Date(data.deadline) : null,
          currentAmount: 0, // Saldo awal selalu 0
        },
      });
      return { status: 'success', message: 'Tabungan berhasil dibuat', data: newGoal };
    } catch (error) {
      throw new InternalServerErrorException('Gagal membuat tabungan.');
    }
  }

  // 2. Ambil Semua Tabungan & Kalkulasi Progress
  async getGoalsByUser(userId: string) {
    const goals = await this.prisma.savingsGoal.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    // Suntikkan kalkulasi 'progress' agar FE tinggal render
    const goalsWithProgress = goals.map(goal => {
      const percentage = (goal.currentAmount / goal.targetAmount) * 100;
      return {
        ...goal,
        progress: Math.min(Math.round(percentage), 100) // Maksimal 100%
      };
    });

    return { status: 'success', data: goalsWithProgress };
  }

  // 3. Ambil Tabungan Spesifik
  async getGoalById(id: string, userId: string) {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id: id, userId: userId },
    });
    if (!goal) throw new NotFoundException('Tabungan tidak ditemukan atau akses ditolak.');
    return goal;
  }

  // 4. Update Tabungan (Tambah Saldo / Edit Target)
  async updateGoal(id: string, userId: string, data: { name?: string; targetAmount?: number; currentAmount?: number; deadline?: string }) {
    await this.getGoalById(id, userId); // Validasi kepemilikan
    
    const updateData: any = { ...data };
    if (data.targetAmount) updateData.targetAmount = Number(data.targetAmount);
    if (data.currentAmount) updateData.currentAmount = Number(data.currentAmount);
    if (data.deadline) updateData.deadline = new Date(data.deadline);

    try {
      const updatedGoal = await this.prisma.savingsGoal.update({
        where: { id: id },
        data: updateData,
      });
      return { status: 'success', message: 'Tabungan diperbarui', data: updatedGoal };
    } catch (error) {
      throw new InternalServerErrorException('Gagal memperbarui tabungan.');
    }
  }

  // 5. Hapus Tabungan
  async deleteGoal(id: string, userId: string) {
    await this.getGoalById(id, userId); // Validasi kepemilikan

    try {
      await this.prisma.savingsGoal.delete({ where: { id: id } });
      return { status: 'success', message: 'Tabungan berhasil dihapus' };
    } catch (error) {
      throw new InternalServerErrorException('Gagal menghapus tabungan.');
    }
  }
}