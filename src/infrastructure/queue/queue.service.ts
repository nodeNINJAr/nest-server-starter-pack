import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import { randomUUID } from 'node:crypto';
import {
  EmailJobType,
  NotificationJobType,
  EmailPayloads,
  PushPayload,
  SmsPayload,
} from './contracts/queue-job.interface';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('email-queue') private readonly emailQueue: Queue,
    @InjectQueue('notification-queue')
    private readonly notificationQueue: Queue,
    @InjectQueue('sms-queue') private readonly smsQueue: Queue,
  ) {}
  private readonly options: JobsOptions = {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  };
  queuePushNotification(data: PushPayload) {
    if (!data.fcmToken) throw new Error('A push recipient token is required');
    // A unique job per device avoids dropping other devices through ID collisions.
    return this.notificationQueue.add(NotificationJobType.PUSH_NOTIFICATION, data, {
      ...this.options,
      jobId: randomUUID(),
    });
  }
  queueSmsNotification(data: SmsPayload) {
    if (!data.to) throw new Error('An SMS recipient is required');
    return this.smsQueue.add('sms_job', data, {
      ...this.options,
      jobId: randomUUID(),
    });
  }
  queueEmail<K extends EmailJobType>(type: K, data: EmailPayloads[K]) {
    return this.emailQueue.add(type, data, this.options);
  }
  queueWelcomeEmail(data: EmailPayloads[EmailJobType.WELCOME_EMAIL]) {
    return this.queueEmail(EmailJobType.WELCOME_EMAIL, data);
  }
  queueOtpEmail(data: EmailPayloads[EmailJobType.OTP_EMAIL]) {
    return this.queueEmail(EmailJobType.OTP_EMAIL, data);
  }
  queueAnnouncementEmail(data: EmailPayloads[EmailJobType.ANNOUNCEMENT_EMAIL]) {
    return this.queueEmail(EmailJobType.ANNOUNCEMENT_EMAIL, data);
  }
  queueVerificationEmail(data: EmailPayloads[EmailJobType.ACCOUNT_VERIFICATION]) {
    return this.queueEmail(EmailJobType.ACCOUNT_VERIFICATION, data);
  }
  queuePasswordResetEmail(data: EmailPayloads[EmailJobType.PASSWORD_RESET]) {
    return this.queueEmail(EmailJobType.PASSWORD_RESET, data);
  }

  async getJobStatus(jobId: string) {
    const job = await this.emailQueue.getJob(jobId);
    if (!job) return null;
    // Job data can contain OTPs, reset URLs, and personal data. Do not expose it.
    return {
      id: job.id,
      name: job.name,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
    };
  }
  async getFailedJobs(limit = 50) {
    const jobs = await this.emailQueue.getFailed(0, Math.max(0, Math.min(limit, 100) - 1));
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
    }));
  }
  async retryFailedJob(jobId: string) {
    const job = await this.emailQueue.getJob(jobId);
    if (!job) return { success: false, message: 'Job not found' };
    await job.retry();
    return { success: true, message: 'Job retry initiated' };
  }
}
