// 💡 "Pintu Belakang" untuk tim developer menguji fitur tanpa membuka database manual.
//  Endpoint ini otomatis mati jika aplikasi di-deploy ke server production.

import {
  Controller,
  Put,
  Post,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanType } from '@prisma/client';
import { SubscriptionReminderService } from '../notifications/subscription-reminder.service';

@Controller('dev')
export class DevController {
  constructor(
    private prisma: PrismaService,
    private readonly subscriptionReminder: SubscriptionReminderService,
  ) {}

  @Put('override-plan')
  @UseGuards(JwtAuthGuard)
  async overridePlan(@Req() req: any, @Body('plan') plan: PlanType) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Endpoint ini tidak tersedia di production.');
    }

    const userId = req.user?.id || req.user?.userId;
    return this.prisma.user.update({
      where: { id: userId },
      data: { plan },
    });
  }

  /**
   * Set plan berbayar + subscriptionEndsAt untuk uji reminder hari-terakhir & READ-ONLY.
   *
   * Body:
   *   { "plan": "PRO", "days": 1 }   -> subscriptionEndsAt = sekarang + 1 hari (besok habis)
   *   { "plan": "PRO", "days": 0 }   -> subscriptionEndsAt = sekarang (hari ini habis)
   *   { "plan": "PRO", "days": -1 }  -> subscriptionEndsAt = kemarin (sudah expired / read-only)
   *   { "plan": "PRO" }              -> subscriptionEndsAt = null (tanpa masa langganan)
   */
  @Put('subscription')
  @UseGuards(JwtAuthGuard)
  async setSubscription(
    @Req() req: any,
    @Body() body: { plan: PlanType; days?: number },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Endpoint ini tidak tersedia di production.');
    }

    const userId = req.user?.id || req.user?.userId;

    if (!['PRO', 'PLATINUM'].includes(body.plan)) {
      throw new ForbiddenException('Gunakan plan PRO atau PLATINUM untuk uji subscription.');
    }

    const data: any = { plan: body.plan };

    if (typeof body.days === 'number' && !isNaN(body.days)) {
      // days bisa < 0 untuk simulate expired
      const end = new Date(Date.now() + body.days * 86400000);
      data.subscriptionEndsAt = end;
      data.trialEndsAt = null;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, plan: true, subscriptionEndsAt: true },
    });

    return {
      status: 'success',
      message:
        typeof body.days === 'number'
          ? `Plan ${body.plan} dengan subscriptionEndsAt ${user.subscriptionEndsAt} (${body.days} hari dari sekarang).`
          : `Plan ${body.plan} di-set tanpa subscriptionEndsAt (null).`,
      data: user,
    };
  }

  /**
   * Set user FREE + trialEndsAt untuk uji notifikasi trial H-1.
   *
   * Body:
   *   { "days": 1 }   -> trialEndsAt = sekarang + 1 hari (besok habis -> H-1)
   *   { "days": 0 }   -> trialEndsAt = sekarang (hari ini habis)
   *   { "days": -2 }  -> trialEndsAt = beberapa hari lalu (trial habis / read-only)
   */
  @Put('trial')
  @UseGuards(JwtAuthGuard)
  async setTrial(@Req() req: any, @Body() body: { days?: number }) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Endpoint ini tidak tersedia di production.');
    }

    const userId = req.user?.id || req.user?.userId;

    const data: any = { plan: 'FREE' };

    if (typeof body.days === 'number' && !isNaN(body.days)) {
      data.trialEndsAt = new Date(Date.now() + body.days * 86400000);
      data.subscriptionEndsAt = null;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, plan: true, trialEndsAt: true, subscriptionEndsAt: true },
    });

    return {
      status: 'success',
      message:
        typeof body.days === 'number'
          ? `Plan FREE dengan trialEndsAt ${user.trialEndsAt} (${body.days} hari dari sekarang).`
          : `Plan FREE di-set tanpa trialEndsAt (null).`,
      data: user,
    };
  }

  /**
   * Panggil cron subscription reminder secara manual (tanpa menunggu tiap jam).
   * Berguna untuk menguji H-3 / H-1 / idempotensi dengan cepat.
   */
  @Post('trigger-subscription-reminder')
  @UseGuards(JwtAuthGuard)
  async triggerSubscriptionReminder(@Req() req: any) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Endpoint ini tidak tersedia di production.');
    }

    const result = await (this.subscriptionReminder as any).process({});
    return {
      status: 'success',
      message: 'Cron subscription reminder dijalankan manual.',
      result,
    };
  }
}
