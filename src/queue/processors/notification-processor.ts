import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationJobType } from '../interfaces/queue-job.interface';
import { NotificationService } from '../services/notiification-services';

@Processor('notification-queue', {
  concurrency: 10,
  limiter: {
    max: 20,
    duration: 1000,
  },
})
@Injectable()
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notifyService: NotificationService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id} | type=${job.name}`);

    switch (job.name) {
      case NotificationJobType.PUSH_NOTIFICATION:
        return this.handlePushNotification(job);

      default:
        throw new Error(`Unknown notification type: ${job.name}`);
    }
  }

  private async handlePushNotification(job: Job) {
    const { userId, fcmToken, title, body, meta } = job.data;

    try {
      const result = await this.notifyService.sendNotificationByType(
        'PUSH_NOTIFICATION',
        [{ fcmToken }],
        title,
        body,
        meta,
      );

      this.logger.log(`Push sent | user=${userId}`);

      return { success: true, userId, result };
    } catch (error) {
      this.logger.error(`Push failed | user=${userId} | error=${error}`);

      throw error; // IMPORTANT: enables BullMQ retry
    }
  }

  // EVENT HANDLERS
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`✅ Notification sent | userId=${job.data.userId} | jobId=${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Notification failed | userId=${job.data.userId} | ${error.message}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`⚡ Processing notification | userId=${job.data.userId}`);
  }

  @OnWorkerEvent('stalled')
  onStalled(job: Job) {
    this.logger.warn(`🧊 Job stalled | userId=${job.data.userId}`);
  }
}
