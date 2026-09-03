import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebPushService } from './web-push.service';

export const SUBSCRIPTION_REMINDER_QUEUE = 'subscription-reminder';
export const SUBSCRIPTION_REMINDER_JOB = 'check-subscription-expiry';

/**
 * Service yang menjalankan cron job untuk:
 * 1. Mengirim notifikasi H-3 (3 hari sebelum subscription habis)
 * 2. Mengirim notifikasi H-1 (1 hari sebelum subscription habis)
 * 3. Menandai user sebagai READ-ONLY jika subscription sudah expired
 *
 * Strategi timezone:
 *   Kita menggunakan "UTC date truncation" untuk menghitung sisa hari.
 *   Keduanya (now dan subscriptionEndsAt) ditruncate ke start-of-day UTC
 *   sehingga hasilnya konsisten tanpa dependensi timezone user.
 *
 * Strategi idempotensi:
 *   Setiap notifikasi (H-3, H-1) ditandai timestamp kirimnya di
 *   NotificationPrefs.lastNotifH3At / lastNotifH1At.
 *   Sebelum mengirim, dicek apakah sudah dikirim hari ini (isSameDay).
 *   Ini memastikan meskipun cron berjalan berkali-kali dalam sehari,
 *   notifikasi hanya terkirim 1x per tipe per user.
 */
@Processor(SUBSCRIPTION_REMINDER_QUEUE)
@Injectable()
export class SubscriptionReminderService
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(SubscriptionReminderService.name);

  constructor(
    @InjectQueue(SUBSCRIPTION_REMINDER_QUEUE)
    private readonly reminderQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly whatsappService: WhatsappService,
    private readonly webPushService: WebPushService,
  ) {
    super();
  }

  async onModuleInit() {
    const cron = '0 * * * *'; // Setiap jam menit ke-0 (sekali per jam)
    await this.reminderQueue.upsertJobScheduler(
      SUBSCRIPTION_REMINDER_JOB,
      { pattern: cron },
      {
        name: SUBSCRIPTION_REMINDER_JOB,
        data: {},
      },
    );
    this.logger.log(
      `Subscription reminder dijadwalkan setiap jam (cron: ${cron}).`,
    );
  }

  async process(job: Job) {
    this.logger.log('Menjalankan pengecekan subscription reminder...');

    const now = new Date();
    const todayStart = this.startOfDayUTC(now);
    const todayEnd = this.endOfDayUTC(now);

    // Batch size untuk handle jutaan user (menghindari OOM)
    const BATCH_SIZE = 500;
    let offset = 0;
    let totalProcessed = 0;

    while (true) {
      // Ambil user dengan plan PRO/PLATINUM yang punya subscriptionEndsAt
      // dan subscription masih dalam rentang yang relevan (max 4 hari ke depan atau sudah expired)
      const maxRelevantDate = new Date(todayStart.getTime() + 4 * 86400000); // 4 hari ke depan

      const users = await this.prisma.user.findMany({
        where: {
          plan: { in: ['PRO', 'PLATINUM'] },
          subscriptionEndsAt: { not: null },
          OR: [
            // Belum expired, max 4 hari lagi (untuk H-3, H-1)
            { subscriptionEndsAt: { gt: now, lte: maxRelevantDate } },
            // Sudah expired tapi masih hari ini (untuk flagging read-only sekali)
            { subscriptionEndsAt: { gte: todayStart, lte: todayEnd } },
          ],
        },
        select: {
          id: true,
          name: true,
          plan: true,
          subscriptionEndsAt: true,
          whatsappNumber: true,
          notifPrefs: true,
        },
        take: BATCH_SIZE,
        skip: offset,
      });

      if (users.length === 0) break;

      for (const user of users) {
        try {
          if (!user.subscriptionEndsAt) continue;

          const daysLeft = this.calculateDaysLeft(now, user.subscriptionEndsAt);

          // === NOTIFIKASI H-3 ===
          if (daysLeft === 3) {
            await this.sendH3Notification(user, now);
          }

          // === NOTIFIKASI H-1 ===
          if (daysLeft === 1) {
            await this.sendH1Notification(user, now);
          }
        } catch (err) {
          this.logger.error(
            `Gagal memproses subscription reminder untuk user ${user.id}: ${err}`,
          );
        }
      }

      totalProcessed += users.length;

      // Jika batch kurang dari BATCH_SIZE, berarti sudah habis
      if (users.length < BATCH_SIZE) break;

      offset += BATCH_SIZE;
    }

    this.logger.log(
      `Subscription reminder selesai. Total user diproses: ${totalProcessed}`,
    );
    return { processed: totalProcessed };
  }

  /**
   * Hitung sisa hari antara sekarang dan subscriptionEndsAt.
   * Menggunakan UTC date truncation agar akurat tanpa dependensi timezone.
   *
   * Contoh:
   *   now = 2025-09-03T23:00:00Z, endsAt = 2025-09-06T01:00:00Z
   *   daysLeft = ceil((Sep6 - Sep3) / 86400000) = 3 ✓
   *
   *   now = 2025-09-03T00:00:00Z, endsAt = 2025-09-06T00:00:00Z
   *   daysLeft = ceil((Sep6 - Sep3) / 86400000) = 3 ✓
   */
  private calculateDaysLeft(now: Date, subscriptionEndsAt: Date): number {
    const nowDay = this.startOfDayUTC(now).getTime();
    const endDay = this.startOfDayUTC(subscriptionEndsAt).getTime();
    return Math.ceil((endDay - nowDay) / 86400000);
  }

  private startOfDayUTC(date: Date): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
  }

  private endOfDayUTC(date: Date): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
  }

  /**
   * Cek apakah timestamp notifikasi terakhir sudah terjadi hari ini.
   * Ini mencegah notifikasi ganda jika cron berjalan berkali-kali dalam sehari.
   */
  private alreadySentToday(
    lastSentAt: Date | null | undefined,
    now: Date,
  ): boolean {
    if (!lastSentAt) return false;
    return this.isSameDay(lastSentAt, now);
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    );
  }

  /**
   * Kirim notifikasi H-3: "Langganan [Pro/Platinum] Anda habis 3 hari lagi."
   */
  private async sendH3Notification(
    user: {
      id: string;
      name: string;
      plan: string;
      subscriptionEndsAt: Date | null;
      whatsappNumber: string | null;
      notifPrefs: {
        lastNotifH3At: Date | null;
        waEnabled: boolean;
        pushEnabled: boolean;
      } | null;
    },
    now: Date,
  ) {
    // Cek idempotensi: sudah dikirim hari ini?
    if (this.alreadySentToday(user.notifPrefs?.lastNotifH3At, now)) {
      this.logger.debug(
        `Notifikasi H-3 untuk user ${user.id} sudah dikirim hari ini. Skip.`,
      );
      return;
    }

    const planLabel = user.plan === 'PLATINUM' ? 'Platinum' : 'Pro';
    const message = `Langganan ${planLabel} Anda habis 3 hari lagi.`;

    this.logger.log(
      `Mengirim notifikasi H-3 ke user ${user.id} (${planLabel})`,
    );

    // 1. In-app notification
    await this.notificationsService.create({
      userId: user.id,
      type: 'SYSTEM',
      title: 'Pengingat Langganan',
      message,
      data: { type: 'SUBSCRIPTION_H3', daysLeft: 3, plan: user.plan },
    });

    // 2. Web Push (jika aktif)
    if (user.notifPrefs?.pushEnabled) {
      await this.webPushService.sendToUser(user.id, {
        title: 'Pengingat Langganan',
        body: message,
        url: '/settings/subscription',
      });
    }

    // 3. WhatsApp (jika aktif & punya nomor)
    if (user.notifPrefs?.waEnabled && user.whatsappNumber) {
      await this.whatsappService.sendMessageToUser(
        user.id,
        `🔔 *Pengingat Langganan Dowith.id*\n\n${message}\n\nSegera perpanjang agar fitur tetap aktif.`,
      );
    }

    // Tandai sudah dikirim (update timestamp)
    await this.prisma.notificationPrefs.upsert({
      where: { userId: user.id },
      update: { lastNotifH3At: now },
      create: { userId: user.id, lastNotifH3At: now },
    });
  }

  /**
   * Kirim notifikasi H-1: "Besok langganan habis! Perbarui sekarang agar Smart Rules & WhatsApp AI tetap aktif."
   */
  private async sendH1Notification(
    user: {
      id: string;
      name: string;
      plan: string;
      subscriptionEndsAt: Date | null;
      whatsappNumber: string | null;
      notifPrefs: {
        lastNotifH1At: Date | null;
        waEnabled: boolean;
        pushEnabled: boolean;
      } | null;
    },
    now: Date,
  ) {
    // Cek idempotensi: sudah dikirim hari ini?
    if (this.alreadySentToday(user.notifPrefs?.lastNotifH1At, now)) {
      this.logger.debug(
        `Notifikasi H-1 untuk user ${user.id} sudah dikirim hari ini. Skip.`,
      );
      return;
    }

    const message =
      'Besok langganan habis! Perbarui sekarang agar Smart Rules & WhatsApp AI tetap aktif.';

    this.logger.log(`Mengirim notifikasi H-1 ke user ${user.id}`);

    // 1. In-app notification
    await this.notificationsService.create({
      userId: user.id,
      type: 'SYSTEM',
      title: 'Langganan Habis Besok!',
      message,
      data: { type: 'SUBSCRIPTION_H1', daysLeft: 1, plan: user.plan },
    });

    // 2. Web Push (jika aktif)
    if (user.notifPrefs?.pushEnabled) {
      await this.webPushService.sendToUser(user.id, {
        title: 'Langganan Habis Besok!',
        body: 'Perbarui sekarang agar Smart Rules & WhatsApp AI tetap aktif.',
        url: '/settings/subscription',
      });
    }

    // 3. WhatsApp (jika aktif & punya nomor)
    if (user.notifPrefs?.waEnabled && user.whatsappNumber) {
      await this.whatsappService.sendMessageToUser(
        user.id,
        `⚠️ *LANGGANAN HABIS BESOK!*\n\n${message}`,
      );
    }

    // Tandai sudah dikirim (update timestamp)
    await this.prisma.notificationPrefs.upsert({
      where: { userId: user.id },
      update: { lastNotifH1At: now },
      create: { userId: user.id, lastNotifH1At: now },
    });
  }
}
