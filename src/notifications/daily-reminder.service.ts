import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebPushService } from './web-push.service';

export const DAILY_REMINDER_QUEUE = 'daily-reminder';
export const DAILY_REMINDER_JOB = 'check-no-transaction';

@Processor(DAILY_REMINDER_QUEUE)
@Injectable()
export class DailyReminderService extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(DailyReminderService.name);

  constructor(
    @InjectQueue(DAILY_REMINDER_QUEUE) private readonly reminderQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly whatsappService: WhatsappService,
    private readonly webPushService: WebPushService,
  ) {
    super();
  }

  // Jadwalkan job berulang SETIAP MENIT.
  // Pemilihan waktu pengiriman dilakukan di dalam process() berdasarkan reminderTime per-user,
  // sehingga setiap user bisa punya jadwal reminder yang berbeda-beda.
  async onModuleInit() {
    const cron = '* * * * *';
    await this.reminderQueue.upsertJobScheduler(
      DAILY_REMINDER_JOB,
      { pattern: cron },
      {
        name: DAILY_REMINDER_JOB,
        data: {},
      },
    );
    this.logger.log(`Reminder harian dijadwalkan setiap menit (filter waktu per-user di process()).`);
  }

  // Ubah "HH:mm" menjadi ekspresi cron (menit, jam, * * *)
  private buildCron(time: string): string {
    const [hour, minute] = time.split(':').map((n) => parseInt(n, 10) || 0);
    return `${minute} ${hour} * * *`;
  }

  // Dipanggil worker @Processor setiap kali ada job masuk
  async process(job: Job) {
    this.logger.log('Menjalankan pengecekan reminder harian...');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Ambil semua user yang mengaktifkan dailyReminder
    const prefs = await this.prisma.notificationPrefs.findMany({
      where: { dailyReminder: true },
      include: { user: { select: { id: true, name: true, whatsappNumber: true } } },
    });

    this.logger.log(`${prefs.length} user terdaftar untuk reminder harian.`);

    // Hanya proses user yang reminderTime-nya cocok dengan jam:menit sekarang (waktu lokal server).
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const duePrefs = prefs.filter((p) => (p.reminderTime || '20:00').slice(0, 5) === currentTime);

    if (duePrefs.length === 0) {
      this.logger.debug(`Belum ada user dengan waktu reminder ${currentTime}. Skipped.`);
      return { processed: 0 };
    }

    this.logger.log(`${duePrefs.length} user dengan jadwal reminder ${currentTime}.`);

    for (const pref of duePrefs) {
      try {
        // Skip jika hari ini sudah dikirim (anti duplikat)
        if (pref.lastReminderDate && this.isSameDay(pref.lastReminderDate, now)) {
          continue;
        }

        const userId = pref.userId;

        // Cek apakah user sudah mencatat transaksi hari ini
        const txCount = await this.prisma.transaction.count({
          where: {
            userId,
            date: { gte: startOfDay, lte: endOfDay },
          },
        });

        if (txCount > 0) {
          // Sudah ada transaksi -> tandai sudah dikirim & lanjut
          await this.prisma.notificationPrefs.update({
            where: { userId },
            data: { lastReminderDate: now },
          });
          continue;
        }

        const userName = pref.user.name || 'Kamu';
        const message = `Halo ${userName}! Kamu belum mencatat transaksi apa pun hari ini. Yuk catat pengeluaran/pemasukanmu sekarang agar keuangan tetap sehat! 🪄`;

        // 1. Simpan notifikasi in-app
        await this.notificationsService.create({
          userId,
          type: 'REMINDER',
          title: 'Belum Mencatat Transaksi',
          message,
          data: { url: '/transactions' },
        });

        // 2. Kirim web push (jika prefs push aktif)
        if (pref.pushEnabled) {
          await this.webPushService.sendToUser(userId, {
            title: 'Belum Mencatat Transaksi',
            body: 'Kamu belum mencatat transaksi hari ini. Yuk catat sekarang!',
            url: '/transactions',
          });
        }

        // 3. Kirim WhatsApp (jika prefs WA aktif & user punya nomor)
        if (pref.waEnabled) {
          await this.whatsappService.sendMessageToUser(userId, `📢 *Pengingat Dowith.id*\n\n${message}`);
        }

        // Tandai sudah dikirim hari ini
        await this.prisma.notificationPrefs.update({
          where: { userId },
          data: { lastReminderDate: now },
        });

        this.logger.log(`Notifikasi reminder dikirim ke user ${userId}`);
      } catch (err) {
        this.logger.error(`Gagal memproses reminder untuk user ${pref.userId}: ${err}`);
      }
    }

    return { processed: duePrefs.length };
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}