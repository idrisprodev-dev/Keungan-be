import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebPushService } from './web-push.service';

export const SUBSCRIPTION_REMINDER_QUEUE = 'subscription-reminder';
export const SUBSCRIPTION_REMINDER_JOB = 'check-subscription-expiry';

// Jam (waktu lokal server) di HARI TERAKHIR saat reminder upgrade dikirim.
// Setelah jam ini lewat, user PRO/PLATINUM yang subscription-nya habis
// sudah dalam status READ-ONLY (ditegakkan oleh PlanStatusGuard).
export const EXPIRY_REMINDER_HOUR = 13;

/**
 * Service yang menjalankan cron job untuk subscription reminder.
 *
 * Spesifikasi:
 *   - PRO/PLATINUM (bulanan/tahunan): reminder "upgrade" dikirim pada HARI TERAKHIR
 *     langganan (subscriptionEndsAt jatuh hari ini) setelah jam 13:00.
 *     Setelah jam 13:00 lewat, user tidak bisa melakukan apa-apa (READ-ONLY) — hanya
 *     mendapat reminder untuk upgrade.
 *   - FREE trial: kirim notif H-1 (1 hari sebelum trialEndsAt habis).
 *   - Tidak ada notifikasi H-3.
 *
 * Strategi timezone:
 *   - Perhitungan "jatuh hari ini" pakai UTC date truncation agar konsisten.
 *   - Batas jam 13:00 memakai waktu lokal server (zona tempat deploy).
 *
 * Strategi idempotensi:
 *   - Kiri terakhir ditandai di NotificationPrefs.lastNotifH1At. Sebelum mengirim,
 *     dicek sudah terkirim hari ini (isSameDay) -> hanya 1x per hari per user.
 *
 * READ-ONLY enforcement (PRO/PLATINUM expired):
 *   - Tidak dilakukan di cron. Ditangani real-time oleh PlanStatusGuard:
 *     jika subscriptionEndsAt <= now, semua mutasi (POST/PUT/PATCH/DELETE) diblokir,
 *     GET tetap diizinkan. Ini otomatis tanpa perlu flag DB.
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
      `Subscription reminder (PRO/Platinum hari-terakhir jam ${EXPIRY_REMINDER_HOUR}.00, trial H-1) dijadwalkan tiap jam (cron: ${cron}).`,
    );
  }

  async process(job: Job) {
    this.logger.log('Menjalankan pengecekan subscription reminder...');

    const now = new Date();
    const todayStart = this.startOfDayUTC(now);
    const todayEnd = this.endOfDayUTC(now);
    // Batas atas tanggal habis yang relevan (besok = +1 hari) untuk trial H-1
    const maxRelevantDate = new Date(todayStart.getTime() + 1 * 86400000);

    // Batch size untuk handle jutaan user (menghindari OOM)
    const BATCH_SIZE = 500;
    let offset = 0;
    let totalProcessed = 0;

    while (true) {
      // Ambil semua user yang relevan:
      //   A) FREE trial berakhir besok (H-1)
      //   B) PRO/PLATINUM subscription berakhir hari ini (utk notif jam 13:00)
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            // A) FREE trial berakhir besok (H-1)
            {
              plan: 'FREE',
              trialEndsAt: { not: null, gt: now, lte: maxRelevantDate },
            },
            // B) PRO/PLATINUM subscription berakhir HARI INI
            {
              plan: { in: ['PRO', 'PLATINUM'] },
              subscriptionEndsAt: { not: null, gte: todayStart, lte: todayEnd },
            },
          ],
        },
        select: {
          id: true,
          name: true,
          plan: true,
          trialEndsAt: true,
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
          await this.processUser(user, now);
        } catch (err) {
          this.logger.error(
            `Gagal memproses subscription reminder untuk user ${user.id}: ${err}`,
          );
        }
      }

      totalProcessed += users.length;

      if (users.length < BATCH_SIZE) break;

      offset += BATCH_SIZE;
    }

    this.logger.log(
      `Subscription reminder selesai. Total user diproses: ${totalProcessed}`,
    );
    return { processed: totalProcessed };
  }

  private async processUser(
    user: {
      id: string;
      name: string;
      plan: string;
      trialEndsAt: Date | null;
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
    if (user.plan === 'FREE') {
      // --- TRIAL FREE: H-1 (besok) ---
      if (
        user.trialEndsAt &&
        this.calculateDaysLeft(now, user.trialEndsAt) === 1
      ) {
        await this.sendTrialExpiryReminder(user, now);
      }
      return;
    }

    // --- PRO / PLATINUM ---
    if (!user.subscriptionEndsAt) return;

    const isExpiryToday = this.isSameDay(user.subscriptionEndsAt, now);

    // Notif reminder upgrade hanya jika subscription HABIS HARI INI
    // DAN sekarang sudah lewat jam 13:00 (EXPIRY_REMINDER_HOUR) waktu lokal.
    if (isExpiryToday && this.isPastExpiryReminderHour(now)) {
      await this.sendPaidExpiryReminder(user, now);
    }
  }

  /**
   * Hitung sisa hari antara sekarang dan tanggal habis (trial/subscription).
   * Menggunakan UTC date truncation agar akurat tanpa dependensi timezone.
   * 0 = hibis hari ini, 1 = besok, dst.
   */
  private calculateDaysLeft(now: Date, expiryDate: Date): number {
    const nowDay = this.startOfDayUTC(now).getTime();
    const endDay = this.startOfDayUTC(expiryDate).getTime();
    return Math.ceil((endDay - nowDay) / 86400000);
  }

  /**
   * Apakah sekarang sudah lewat jam 13:00 (waktu lokal server)?
   * Jika ya, user PRO/PLATINUM yang subscription-nya habis hari ini
   * dianggap READ-ONLY (didukung guard) dan mendapat reminder upgrade.
   */
  private isPastExpiryReminderHour(now: Date): boolean {
    const cutoff = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      EXPIRY_REMINDER_HOUR,
      0,
      0,
      0,
    );
    return now.getTime() >= cutoff.getTime();
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
   * Mencegah notifikasi ganda jika cron berjalan berkali-kali dalam sehari.
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
   * Notif H-1 untuk user FREE dengan trial habis besok.
   */
  private async sendTrialExpiryReminder(
    user: {
      id: string;
      name: string;
      plan: string;
      whatsappNumber: string | null;
      notifPrefs: {
        lastNotifH1At: Date | null;
        waEnabled: boolean;
        pushEnabled: boolean;
      } | null;
    },
    now: Date,
  ) {
    if (this.alreadySentToday(user.notifPrefs?.lastNotifH1At, now)) {
      this.logger.debug(
        `Notifikasi trial H-1 untuk user ${user.id} sudah dikirim hari ini. Skip.`,
      );
      return;
    }

    const title = 'Akses Trial Habis Besok!';
    const message =
      'Akses trial Dowith.id besok habis. Perbarui ke paket Pro/Platinum untuk terus mencatat transaksi & fitur premium tetap aktif.';

    this.logger.log(
      `Mengirim notifikasi trial H-1 ke user ${user.id} (FREE)`,
    );

    await this.deliver(user, title, message, { type: 'TRIAL_H1', daysLeft: 1 });
    await this.trackSent(user.id, now);
  }

  /**
   * Notif reminder upgrade untuk PRO/PLATINUM di hari terakhir langganan
   * (setelah jam 13:00). User sudah dalam status READ-ONLY.
   */
  private async sendPaidExpiryReminder(
    user: {
      id: string;
      name: string;
      plan: string;
      whatsappNumber: string | null;
      notifPrefs: {
        lastNotifH1At: Date | null;
        waEnabled: boolean;
        pushEnabled: boolean;
      } | null;
    },
    now: Date,
  ) {
    // Idempotensi 1x/hari
    if (this.alreadySentToday(user.notifPrefs?.lastNotifH1At, now)) {
      this.logger.debug(
        `Reminder upgrade untuk user ${user.id} sudah dikirim hari ini. Skip.`,
      );
      return;
    }

    const planLabel = user.plan === 'PLATINUM' ? 'Platinum' : 'Pro';
    const title = 'Langganan Habis Hari Ini!';
    const message = `Langganan ${planLabel} Anda habis hari ini. Perbarui sekarang agar Smart Rules & WhatsApp AI tetap aktif.`;

    this.logger.log(
      `Mengirim reminder upgrade (hari terakhir jam ${EXPIRY_REMINDER_HOUR}.00) ke user ${user.id} (${user.plan})`,
    );

    await this.deliver(user, title, message, {
      type: 'SUBSCRIPTION_EXPIRY_DAY',
      plan: user.plan,
    });
    await this.trackSent(user.id, now);
  }

  /**
   * Kirim notifikasi ke 3 kanal: in-app, web push, whatsapp.
   */
  private async deliver(
    user: {
      id: string;
      whatsappNumber: string | null;
      notifPrefs: {
        waEnabled: boolean;
        pushEnabled: boolean;
      } | null;
    },
    title: string,
    message: string,
    data: Record<string, unknown>,
  ) {
    // 1. In-app notification
    await this.notificationsService.create({
      userId: user.id,
      type: 'SYSTEM',
      title,
      message,
      data,
    });

    // 2. Web Push (jika aktif)
    if (user.notifPrefs?.pushEnabled) {
      await this.webPushService.sendToUser(user.id, {
        title,
        body: message,
        url: '/settings/subscription',
      });
    }

    // 3. WhatsApp (jika aktif & punya nomor)
    if (user.notifPrefs?.waEnabled && user.whatsappNumber) {
      await this.whatsappService.sendMessageToUser(
        user.id,
        `⚠️ *${title}*\n\n${message}`,
      );
    }
  }

  /**
   * Tandai notifikasi sudah terkirim hari ini (anti-duplikat).
   */
  private async trackSent(userId: string, now: Date) {
    await this.prisma.notificationPrefs.upsert({
      where: { userId },
      update: { lastNotifH1At: now },
      create: { userId, lastNotifH1At: now },
    });
  }
}
