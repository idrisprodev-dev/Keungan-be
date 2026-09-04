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

    // PRO/PLATINUM wajib punya subscriptionEndsAt aktif. Jika null atau sudah lewat => expired.
    const isPaidPlan = user.plan === 'PRO' || user.plan === 'PLATINUM';
    const hasActiveSubscription = isPaidPlan && user.subscriptionEndsAt != null && user.subscriptionEndsAt > now;
    const subscriptionActive = hasActiveSubscription;
    const subscriptionExpired = isPaidPlan && !hasActiveSubscription;

    // Read-only jika: (FREE + trial habis) ATAU (PRO/PLATINUM + subscription expired/tidak ada)
    const isReadOnly = subscriptionExpired || (!isPaidPlan && !isTrialActive);

    // Banner peringatan untuk frontend
    let banner: { show: boolean; title: string; message: string; type: string } | null = null;
    if (isReadOnly) {
      if (isPaidPlan) {
        // PRO/PLATINUM expired
        banner = {
          show: true,
          title: 'Langganan Kedaluwarsa',
          message: 'Paket Anda telah berakhir. Perbarui langganan untuk melanjutkan pencatatan transaksi.',
          type: 'warning',
        };
      } else if (user.plan === 'FREE' && !isTrialActive) {
        // FREE trial habis
        banner = {
          show: true,
          title: 'Masa Trial Berakhir',
          message: 'Masa trial gratis Anda telah berakhir. Upgrade ke Pro/Platinum untuk terus mencatat transaksi.',
          type: 'warning',
        };
      }
    }

    return {
      status: 'success',
      data: {
        ...user,
        subscription: {
          subscriptionEndsAt: user.subscriptionEndsAt,
          subscriptionActive,
          subscriptionExpired,
          daysLeft: user.subscriptionEndsAt
            ? Math.ceil((user.subscriptionEndsAt.getTime() - now.getTime()) / 86400000)
            : null,
          isReadOnly,
        },
        trial: {
          isTrialActive,
          hasTrial: trialEndsAt != null,
          trialEndsAt,
          daysLeft: trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000)) : 0,
          subscriptionActive,
        },
        banner,
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
  async updatePlan(userId: string, plan: string, days?: number) {
    const data: any = { plan: plan as any };

    if (plan === 'FREE') {
      // FREE: set trialEndsAt jika ada parameter days, clear subscriptionEndsAt
      data.subscriptionEndsAt = null;
      if (days && days > 0) {
        const trialEndsAt = new Date();
        trialEndsAt.setHours(trialEndsAt.getHours() + days * 24);
        data.trialEndsAt = trialEndsAt;
      }
    } else if (plan === 'PRO' || plan === 'PLATINUM') {
      // PRO/PLATINUM: set subscriptionEndsAt
      data.trialEndsAt = null;
      if (days && days > 0) {
        // Jika ada parameter days, hitung dari sekarang
        const subscriptionEndsAt = new Date();
        subscriptionEndsAt.setHours(subscriptionEndsAt.getHours() + days * 24);
        data.subscriptionEndsAt = subscriptionEndsAt;
      } else if (!days) {
        // Default: 30 hari dari sekarang
        const subscriptionEndsAt = new Date();
        subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 30);
        data.subscriptionEndsAt = subscriptionEndsAt;
      }
    }

    return await this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
        