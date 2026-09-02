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

    const planHierarchy = { FREE: 1, PRO: 2, PLATINUM: 3 };

    // ========================================================
    // 🎁 LOGIKA TRIAL
    // Selama masa trial aktif, user diperlakukan seperti PRO.
    // Jika trial habis DAN tidak punya plan berbayar, turunkan ke FREE.
    // ========================================================
    let activePlan = user.plan;

    if (user.plan === 'FREE') {
      const now = new Date();
      const trialActive = user.trialEndsAt && user.trialEndsAt > now;
      if (trialActive) {
        activePlan = 'PRO'; // Trial aktif -> fitur PRO dibuka
      }
    }

    if (planHierarchy[activePlan] < planHierarchy[requiredPlan]) {
      throw new ForbiddenException(`Akses ditolak: Fitur ini membutuhkan paket ${requiredPlan}.`);
    }

    return true;
  }
}