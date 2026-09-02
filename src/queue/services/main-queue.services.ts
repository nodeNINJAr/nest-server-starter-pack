import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import { EmailJobType, NotificationJobType } from '../interfaces/queue-job.interface';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('email-queue')
    private readonly emailQueue: Queue,
    @InjectQueue('notification-queue') private notificationQueue: Queue,
    @InjectQueue('sms-queue') private smsQueue: Queue,
  ) {}

  // Default job configuration
  private readonly defaultJobOptions: JobsOptions = {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  };

  // PUSH NOTIFICATIONS
  async queuePushNotification(data: {
    userId: string;
    fcmToken: string;
    title: string;
    body: string;
    meta?: Record<string, any>;
  }) {
    try {
      if (!data.fcmToken) {
        this.logger.warn(`Skipping push: missing token for user ${data.userId}`);
        return;
      }

      const job = await this.notificationQueue.add(NotificationJobType.PUSH_NOTIFICATION, data, {
        ...this.defaultJobOptions,
        jobId: `push-${data.userId}-${data.meta?.orderId ?? Date.now()}`,
      });

      this.logger.log(`Push queued | user=${data.userId} | jobId=${job.id}`);

      return job;
    } catch (error) {
      this.logger.error('Failed to queue push notification:', error);
      throw error;
    }
  }

  // sms queue
  async queueSmsNotification(
    data:
      | { to: string; otp: string; name: string; trigger: string; type: 'sms_otp' }
      | { to: string; message: string; type: 'sms_notification' },
  ) {
    try {
      if (!data.to) {
        this.logger.warn('Skipping SMS: missing phone number');
        return;
      }

      const job = await this.smsQueue.add(
        'sms_job',
        {
          ...data,
        },
        {
          ...this.defaultJobOptions,
          jobId: `sms:${Date.now()}:${data.to}`,
        },
      );

      this.logger.log(`SMS queued | to=${data.to} | jobId=${job.id}`);

      return job;
    } catch (error) {
      this.logger.error('Failed to queue SMS:', error);
      throw error;
    }
  }

  async queueWelcomeEmail(data: {
    userId: string;
    email: string;
    username?: string;
    referralCode?: string;
  }) {
    try {
      const job = await this.emailQueue.add(
        EmailJobType.WELCOME_EMAIL,
        data,
        this.defaultJobOptions,
      );

      this.logger.log(`Welcome email queued for user ${data.userId}, Job ID: ${job.id}`);

      return job;
    } catch (error) {
      this.logger.error('Failed to queue welcome email', error?.stack);
      throw error;
    }
  }

  async queueOtpEmail(data: { email: string; otp: string; name?: string }) {
    try {
      const job = await this.emailQueue.add(EmailJobType.OTP_EMAIL, data, this.defaultJobOptions);

      this.logger.log(`OTP email queued for ${data.email}, Job ID: ${job.id}`);

      return job;
    } catch (error) {
      this.logger.error('Failed to queue OTP email', error?.stack);
      throw error;
    }
  }

  // ───────────────── ANNOUNCEMENTS ─────────────────

  async queueAnnouncementEmail(data: {
    email: string;
    title: string;
    message: string;
    imageUrl?: string;
  }) {
    try {
      const job = await this.emailQueue.add(
        EmailJobType.ANNOUNCEMENT_EMAIL,
        data,
        this.defaultJobOptions,
      );

      this.logger.log(`Announcement email queued for ${data.email}, Job ID: ${job.id}`);

      return job;
    } catch (error) {
      this.logger.error('Failed to queue announcement email', error?.stack);
      throw error;
    }
  }

  // ───────────────── EMAIL VERIFICATION ─────────────────

  async queueVerificationEmail(data: { email: string; name?: string; verificationUrl: string }) {
    try {
      const job = await this.emailQueue.add(
        EmailJobType.ACCOUNT_VERIFICATION,
        data,
        this.defaultJobOptions,
      );

      this.logger.log(`Verification email queued for ${data.email}, Job ID: ${job.id}`);

      return job;
    } catch (error) {
      this.logger.error('Failed to queue verification email', error?.stack);
      throw error;
    }
  }

  // ───────────────── PASSWORD RESET ─────────────────

  async queuePasswordResetEmail(data: { email: string; name?: string; resetLink: string }) {
    try {
      const job = await this.emailQueue.add(
        EmailJobType.PASSWORD_RESET,
        data,
        this.defaultJobOptions,
      );

      this.logger.log(`Password reset email queued for ${data.email}, Job ID: ${job.id}`);

      return job;
    } catch (error) {
      this.logger.error('Failed to queue password reset email', error?.stack);
      throw error;
    }
  }

  // ───────────────── MONITORING ─────────────────

  async getJobStatus(jobId: string) {
    const job = await this.emailQueue.getJob(jobId);

    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      progress: job.progress,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      data: job.data,
      returnvalue: job.returnvalue,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  async getFailedJobs(limit = 50) {
    const failed = await this.emailQueue.getFailed(0, limit);

    return failed.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    }));
  }

  async retryFailedJob(jobId: string) {
    const job = await this.emailQueue.getJob(jobId);

    if (!job) {
      return { success: false, message: 'Job not found' };
    }

    await job.retry();

    return {
      success: true,
      message: 'Job retry initiated',
    };
  }
}
