        import { Injectable } from '@nestjs/common';
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

    async updateUser(id: string, data: { name?: string; plan?: 'TRIAL' | 'PRO' | 'PLATINUM' }) {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: id },
        data: {
          name: data.name,
          plan: data.plan,
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
        }