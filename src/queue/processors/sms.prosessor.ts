import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SmsService } from '../services/sms-services';

@Processor('sms-queue', {
  concurrency: 10,
  limiter: {
    max: 20,
    duration: 1000,
  },
})
@Injectable()
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(private readonly smsService: SmsService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id}`);

    switch (job.data.type) {
      case 'sms_otp':
        return this.handleSmsOtp(job);

      case 'sms_notification':
        return this.handleSmsNotification(job);

      default:
        throw new Error(`Unknown job type: ${job.data.type}`);
    }
  }

  private async handleSmsOtp(job: Job) {
    const { name, to, otp, trigger } = job.data;

    if (!to) {
      throw new Error('Phone number missing');
    }

    const message = `${name} your OTP code is ${otp} for ${trigger}`;

    await this.smsService.sendOptMessage(to, message);

    this.logger.log(`SMS sent | user=${name}`);

    return { success: true };
  }

  private async handleSmsNotification(job: Job) {
    const { to, message } = job.data;

    if (!to) {
      throw new Error('Phone number missing');
    }

    await this.smsService.sendOptMessage(to, message);

    this.logger.log(`SMS notification sent | to=${to}`);

    return { success: true };
  }

  // EVENT HANDLERS
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`✅ Sms sent | userId=${job.data.phone} | jobId=${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Sms failed | userId=${job.data.phone} | ${error.message}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`⚡ Processing sms | userId=${job.data.phone}`);
  }

  @OnWorkerEvent('stalled')
  onStalled(job: Job) {
    this.logger.warn(`🧊 Job stalled | userId=${job.data.phone}`);
  }
}
