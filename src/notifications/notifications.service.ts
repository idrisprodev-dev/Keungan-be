import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // Ambil daftar notifikasi milik user (terbaru dulu)
  async findAll(userId: string, limit = 30) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      status: 'success',
      data: notifications,
      unreadCount,
    };
  }

  // Hitung notifikasi yang belum dibaca
  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { status: 'success', unreadCount };
  }

  // Tandai satu notifikasi dibaca
  async markRead(userId: string, notificationId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notif) {
      throw new NotFoundException('Notifikasi tidak ditemukan');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { status: 'success', data: updated, unreadCount };
  }

  // Tandai SEMUA notifikasi dibaca
  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { status: 'success', unreadCount: 0 };
  }

  // Buat notifikasi (dipakai oleh modul lain: reminder, budget, WA, dll)
  async create(
    payload: {
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      data?: any;
    },
  ) {
    return this.prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data ?? undefined,
      },
    });
  }

  // Hapus notifikasi
  async remove(userId: string, notificationId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notif) {
      throw new NotFoundException('Notifikasi tidak ditemukan');
    }

    await this.prisma.notification.delete({ where: { id: notificationId } });
    return { status: 'success', message: 'Notifikasi dihapus' };
  }

  async getNotificationPrefs(userId: string) {
    let prefs = await this.prisma.notificationPrefs.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await this.prisma.notificationPrefs.create({
        data: { userId },
      });
    }

    return { status: 'success', data: prefs };
  }

  async updateNotificationPrefs(userId: string, body: Partial<{
    waEnabled: boolean;
    pushEnabled: boolean;
    dailyReminder: boolean;
    reminderTime: string;
  }>) {
    const prefs = await this.prisma.notificationPrefs.upsert({
      where: { userId },
      update: {
        waEnabled: body.waEnabled ?? undefined,
        pushEnabled: body.pushEnabled ?? undefined,
        dailyReminder: body.dailyReminder ?? undefined,
        reminderTime: body.reminderTime ?? undefined,
      },
      create: {
        userId,
        waEnabled: body.waEnabled ?? true,
        pushEnabled: body.pushEnabled ?? true,
        dailyReminder: body.dailyReminder ?? true,
        reminderTime: body.reminderTime ?? '20:00',
      },
    });

    return { status: 'success', data: prefs };
  }
}