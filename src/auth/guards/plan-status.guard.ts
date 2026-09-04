import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { SKIP_PLAN_STATUS_KEY } from '../decorators/skip-plan-status.decorator';

/**
 * PlanStatusGuard — Memblokir semua operasi tulis (POST/PUT/DELETE/PATCH)
 * saat masa trial atau langganan user telah habis (READ-ONLY mode).
 *
 * Dipasang di setiap controller secara eksplisit via @UseGuards().
 * Route GET/OPTIONS/HEAD selalu diizinkan (read-only mode).
 */
@Injectable()
export class PlanStatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Cek @SkipPlanStatus() — route ini dikecualikan
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PLAN_STATUS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest();
    const method = req.method;

    // 2. Method GET/OPTIONS/HEAD selalu boleh (read-only mode)
    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
      return true;
    }

    // 3. Ambil userId dari JWT payload
    const userId = req.user?.id || req.user?.userId || req.user?.sub;

    // 4. Jika tidak ada userId (route publik tanpa JWT), skip
    if (!userId) return true;

    // 5. Ambil data user dari database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, plan: true, subscriptionEndsAt: true, trialEndsAt: true },
    });

    if (!user) {
      throw new ForbiddenException('Akses ditolak: Data user tidak terdaftar.');
    }

    const now = new Date();
    const plan = user.plan;
    const subEnd = user.subscriptionEndsAt;
    const trialEnd = user.trialEndsAt;

    console.log(`[PlanStatusGuard] ${method} ${req.originalUrl} | plan=${plan} | subEnd=${subEnd} | trialEnd=${trialEnd} | now=${now.toISOString()}`);

    // ============================================================
    // KONDISI BLOCK (read-only):
    //   A. User FREE + trial habis → BLOCK
    //   B. User PRO/PLATINUM + (subscriptionEndsAt null ATAU sudah lewat) → BLOCK
    // ============================================================

    // --- KONDISI A: User FREE dengan trial sudah habis ---
    if (plan !== 'PRO' && plan !== 'PLATINUM') {
      const trialAktif = trialEnd != null && trialEnd.getTime() > now.getTime();
      if (!trialAktif) {
        console.log(`[PlanStatusGuard] → BLOCKED: FREE trial expired`);
        throw new ForbiddenException(
          'Akses ditolak: Masa trial atau langganan Anda telah berakhir. Upgrade ke Pro/Platinum untuk terus mencatat transaksi.',
        );
      }
      // FREE dengan trial aktif → boleh lanjut
      return true;
    }

    // --- KONDISI B: User PRO atau PLATINUM ---
    // PRO/PLATINUM HARUS punya subscriptionEndsAt yang masih aktif (masa depan)
    if (subEnd == null || subEnd.getTime() <= now.getTime()) {
      console.log(`[PlanStatusGuard] → BLOCKED: ${plan} subscription expired (subEnd=${subEnd})`);
      throw new ForbiddenException(
        'Akses ditolak: Langganan Anda telah kedaluwarsa. Perbarui langganan untuk melanjutkan pencatatan transaksi.',
      );
    }

    // PRO/PLATINUM dengan subscription aktif → boleh lanjut
    console.log(`[PlanStatusGuard] → PASSED: ${plan} subscription active until ${subEnd}`);
    return true;
  }
}
