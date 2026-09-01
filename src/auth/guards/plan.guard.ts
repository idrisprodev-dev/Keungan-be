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
    
    // Sekarang user.plan sudah aman dari error null / property missing
    if (planHierarchy[user.plan] < planHierarchy[requiredPlan]) {
      throw new ForbiddenException(`Akses ditolak: Fitur ini membutuhkan paket ${requiredPlan}.`);
    }

    return true;
  }
}