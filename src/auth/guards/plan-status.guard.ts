import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * PlanStatusGuard — Memastikan hanya user dengan plan aktif yang boleh melakukan
 * operasi penulisan data (POST / PUT / DELETE / PATCH).
 *
 * Kondisi READ-ONLY (blokir semua mutating request):
 *   1. User FREE dengan trial sudah habis (logika lama).
 *   2. User PRO/PLATINUM dengan subscriptionEndsAt sudah lewat (expired).
 *
 * Method GET / OPTIONS / HEAD selalu diizinkan agar user tetap bisa
 * melihat riwayat data lama mereka (read-only mode).
 */
@Injectable()
export class PlanStatusGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Read-only selalu boleh, apa pun status paket user.
    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
      return true;
    }

    const userId = request.user?.id || request.user?.userId || request.user?.sub;

    if (!userId) {
      throw new ForbiddenException('Akses ditolak: User tidak ditemukan.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new ForbiddenException('Akses ditolak: Data user tidak terdaftar.');
    }

    const now = new Date();

    // === KONDISI 1: User FREE dengan trial sudah habis ===
    const trialActive = user.plan === 'FREE' && user.trialEndsAt != null && user.trialEndsAt > now;
    const isHardFree = user.plan !== 'PRO' && user.plan !== 'PLATINUM' && !trialActive;

    if (isHardFree) {
      throw new ForbiddenException(
        'Akses ditolak: Masa trial atau langganan Anda telah berakhir. Upgrade ke Pro/Platinum untuk terus mencatat transaksi.',
      );
    }

    // === KONDISI 2: User PRO/PLATINUM dengan subscription sudah expired ===
    const isPaidPlan = user.plan === 'PRO' || user.plan === 'PLATINUM';
    const subscriptionExpired = isPaidPlan && user.subscriptionEndsAt != null && user.subscriptionEndsAt <= now;

    if (subscriptionExpired) {
      throw new ForbiddenException(
        'Akses ditolak: Langganan Anda telah kedaluwarsa. Perbarui langganan untuk melanjutkan pencatatan transaksi.',
      );
    }

    return true;
  }
}
