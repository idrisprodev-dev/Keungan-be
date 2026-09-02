        import { Injectable, NotFoundException } from '@nestjs/common';
        import { PrismaService } from '../prisma/prisma.service'; // Pastikan path ini sesuai dengan lokasi PrismaService Anda

        @Injectable()
        export class UsersService {
        constructor(private prisma: PrismaService) {}

        // Fungsi untuk mengambil semua data user dari database
        async getAllUsers() {
            try {
            const users = await this.prisma.user.findMany();
            return {
                status: 'success',
                message: 'Data pengguna berhasil diambil',
                data: users,
                
            };
            } catch (error) {
            return {
                status: 'error',
                message: 'Gagal mengambil data pengguna',
                error_detail: error instanceof Error ? error.message : 'Unknown error',
            };
            }
        }

        async createUser(data: { name: string; email: string }) {
        try {
        // Prisma akan menolak jika email sudah ada di database (karena @unique di skema)
        const newUser = await this.prisma.user.create({
            data: {
            name: data.name,
            email: data.email,
            // plan, trialEndsAt, dan createdAt akan otomatis diisi nilai default oleh Prisma
            },
        });
        
        return {
            status: 'success',
            message: 'Pengguna baru berhasil ditambahkan',
            data: newUser,
        };
        } catch (error) {
        return {
            status: 'error',
            message: 'Gagal membuat pengguna baru',
            error_detail: error instanceof Error ? error.message : 'Unknown error',
        };
        }
    }

    async updateUser(id: string, data: { name?: string; plan?: string }) {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: id },
        data: {
          name: data.name,
        },
      });

      return {
        status: 'success',
        message: 'Data pengguna berhasil diperbarui',
        data: updatedUser,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Gagal memperbarui pengguna. Pastikan ID valid.',
        error_detail: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // 4. Fungsi DELETE: Menghapus pengguna berdasarkan ID
  async deleteUser(id: string) {
    try {
      const deletedUser = await this.prisma.user.delete({
        where: { id: id },
      });

      return {
        status: 'success',
        message: 'Pengguna berhasil dihapus dari sistem',
        data: deletedUser,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Gagal menghapus pengguna. Pastikan ID valid.',
        error_detail: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        picture: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        plan: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        whatsappNumber: true,
        // Kita tidak men-select data sensitif jika ada
      }
    });

    if (!user) {
      throw new NotFoundException('Data pengguna tidak ditemukan di dalam sistem.');
    }

    const now = new Date();
    const trialEndsAt = user.trialEndsAt;
    const isTrialActive = user.plan === 'FREE' && trialEndsAt != null && trialEndsAt > now;
    const subscriptionActive = user.subscriptionEndsAt != null && user.subscriptionEndsAt > now;

    return {
      status: 'success',
      data: {
        ...user,
        trial: {
          isTrialActive,
          hasTrial: trialEndsAt != null,
          trialEndsAt,
          daysLeft: trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000)) : 0,
          subscriptionActive,
        },
      },
    };
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; name?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Data pengguna tidak ditemukan di dalam sistem.');
    }

    const firstName = data.firstName ?? user.firstName ?? '';
    const lastName = data.lastName ?? user.lastName ?? '';
    const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const displayName = data.name ?? (combinedName || user.name);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName ?? user.firstName ?? null,
        lastName: data.lastName ?? user.lastName ?? null,
        name: displayName,
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        picture: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        plan: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
      },
    });

    return { status: 'success', message: 'Profil berhasil diperbarui', data: updatedUser };
  }
  async updatePlan(userId: string, plan: string) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { plan: plan as any },
    });
  }
}
        