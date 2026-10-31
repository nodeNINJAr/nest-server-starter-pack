import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { PushNotificationService } from './notifications.service';

@Module({
  imports: [DatabaseModule, QueueModule],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class NotificationsModule {}
