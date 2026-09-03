import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { WebPushService } from './web-push.service';
import { WebPushController } from './web-push.controller';
import { DailyReminderService, DAILY_REMINDER_QUEUE } from './daily-reminder.service';
import {
  SubscriptionReminderService,
  SUBSCRIPTION_REMINDER_QUEUE,
} from './subscription-reminder.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    WhatsappModule,
    BullModule.registerQueue(
      { name: DAILY_REMINDER_QUEUE },
      { name: SUBSCRIPTION_REMINDER_QUEUE },
    ),
  ],
  controllers: [NotificationsController, WebPushController],
  providers: [
    NotificationsService,
    WebPushService,
    DailyReminderService,
    SubscriptionReminderService,
  ],
  exports: [NotificationsService, WebPushService, SubscriptionReminderService],
})
export class NotificationsModule {}