import { LoggedWorker } from './logged-worker';
import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SmsCore } from '../../messaging/sms/sms.service';
import { SmsPayload } from '../contracts/queue-job.interface';

@Processor('sms-queue', {
  concurrency: 10,
  limiter: { max: 20, duration: 1000 },
})
export class SmsProcessor extends LoggedWorker {
  constructor(private readonly sms: SmsCore) {
    super();
  }
  async process(job: Job<SmsPayload>) {
    const data = job.data;
    if (!data.to) throw new Error('An SMS recipient is required');
    switch (data.type) {
      case 'sms_otp':
        return this.sms.send({
          to: data.to,
          message: `${data.name} your OTP code is ${data.otp} for ${data.trigger}`,
        });
      case 'sms_notification':
        return this.sms.send({ to: data.to, message: data.message });
      default:
        throw new Error('Unknown SMS job type');
    }
  }
}
