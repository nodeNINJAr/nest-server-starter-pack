import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common-module';
import { EmailProcessor } from './processors/email-processor';
import { NotificationService } from './services/notiification-services';
import { NotificationProcessor } from './processors/notification-processor';
import { FirebaseService } from '../common/services/firebase/firebase-services';
import { QueueService } from './services/main-queue.services';
import { SmsProcessor } from './processors/sms.prosessor';
import { SmsService } from './services/sms-services';
import { PushNotificationService } from './services/push-notification.service';

@Module({
  imports: [
    // Register queues
    BullModule.registerQueue({
      name: 'email-queue',
    }),
    BullModule.registerQueue({
      name: 'notification-queue',
    }),
    BullModule.registerQueue({
      name: 'sms-queue',
    }),
    CommonModule,
  ],
  providers: [
    QueueService,
    EmailProcessor,
    NotificationProcessor,
    SmsProcessor,
    SmsService,
    NotificationService,
    FirebaseService,
    PushNotificationService,
  ],
  exports: [QueueService, PushNotificationService],
})
export class QueueModule {}
