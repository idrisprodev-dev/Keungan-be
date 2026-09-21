import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PLAN_KEY, PlanLevel } from '../decorators/require-plan.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<PlanLevel>(REQUIRE_PLAN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPlan) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.user?.userId;

    if (!userId) throw new ForbiddenException('Akses ditolak: User tidak ditemukan');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    // Validasi untuk memastikan user benar-benar ada di database
    if (!user) {
      throw new ForbiddenException('Akses ditolak: Data user tidak terdaftar.');
    }

    // ========================================================
    // 🔒 PROTEksi PAKSA: Tolak operasi modifikasi jika akun expired
    // Hanya izinkan GET (read-only) jika masa aktif habis
    // ========================================================
    const isGetRequest = request.method === 'GET';
    const now = new Date();

    const isPaidPlan = user.plan === 'PRO' || user.plan === 'PLATINUM';
    const hasActiveSubscription = isPaidPlan && user.subscriptionEndsAt != null && user.subscriptionEndsAt > now;
    const isTrialActive = user.trialEndsAt && user.trialEndsAt > now;

    // User dianggap expired jika:
    // 1. User FREE tanpa trial aktif, ATAU
    // 2. User PRO/PLATINUM tanpa subscription aktif
    const isExpired = (!isPaidPlan && !isTrialActive) || (isPaidPlan && !hasActiveSubscription);

    if (isExpired && !isGetRequest) {
      throw new ForbiddenException('Masa aktif habis. Aplikasi dalam mode Read-Only.');
    }

    const planHierarchy = { FREE: 1, PRO: 2, PLATINUM: 3 };

    // ========================================================
    // 🎁 LOGIKA TRIAL & SUBSCRIPTION
    // - Selama masa trial aktif, user FREE diperlakukan seperti PRO.
    // - Jika SUBSCRIPTION user PRO/PLATINUM sudah expired, turunkan
    //   menjadi FREE (tidak bisa akses fitur PRO/PLATINUM).
    // - Jika trial habis DAN tidak punya plan berbayar, turunkan ke FREE.
    // ========================================================
    let activePlan = user.plan;

    if (isPaidPlan && !hasActiveSubscription) {
      activePlan = 'FREE';
    }

    if (activePlan === 'FREE') {
      if (isTrialActive) {
        activePlan = 'PRO'; // Trial aktif -> fitur PRO dibuka
      }
    }

    if (planHierarchy[activePlan] < planHierarchy[requiredPlan]) {
      throw new ForbiddenException(`Akses ditolak: Fitur ini membutuhkan paket ${requiredPlan}.`);
    }

    return true;
  }
}