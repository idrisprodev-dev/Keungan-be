import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    // VAPID keys: generate dengan perintah
    // `npx web-push generate-vapid-keys --json`
    // lalu isi di .env (WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY)
    const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    const subject = process.env.WEB_PUSH_SUBJECT || 'mailto:admin@dowith.id';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.logger.log('Web Push berhasil dikonfigurasi dengan VAPID keys.');
    } else {
      this.logger.warn(
        'WEB_PUSH_VAPID keys belum diisi di .env. Web Push nonaktif. Jalankan: npx web-push generate-vapid-keys --json',
      );
    }
  }

  // Simpan / daftarkan subscription browser user
  async subscribe(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      throw new BadRequestException('Payload subscription web push tidak valid');
    }

    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
    });

    return { status: 'success', message: 'Subscription berhasil disimpan' };
  }

  // Hapus subscription (misal ketika user logout / browser menonaktifkan)
  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { status: 'success', message: 'Subscription dihapus' };
  }

  // Kirim push ke SEMUA device user
  async sendToUser(userId: string, payload: { title: string; body: string; url?: string; icon?: string }) {
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return { status: 'skipped', reason: 'no-subscription' };

    const data = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/dashboard',
      icon: payload.icon || '/icons/icon-192.png',
      timestamp: new Date().toISOString(),
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          data,
        );
        sent++;
      } catch (err: any) {
        failed++;
        this.logger.warn(`Gagal kirim web push: ${err?.message || err}`);
        // 404 / 410 = subscription expired, hapus dari DB
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
        }
      }
    }

    return { status: 'success', sent, failed };
  }

  // Data yang dibutuhkan frontend untuk membuat subscription
  getPublicKey() {
    const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return { status: 'error', message: 'VAPID public key belum dikonfigurasi di server' };
    }
    return { status: 'success', publicKey };
  }
}