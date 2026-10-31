import { LoggedWorker } from './logged-worker';
import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FirebaseService } from '../../messaging/push/firebase.service';
import { NotificationJobType, PushPayload } from '../contracts/queue-job.interface';

@Processor('notification-queue', {
  concurrency: 10,
  limiter: { max: 20, duration: 1000 },
})
export class NotificationProcessor extends LoggedWorker {
  constructor(private readonly firebase: FirebaseService) {
    super();
  }
  async process(job: Job<PushPayload>) {
    if (job.name !== NotificationJobType.PUSH_NOTIFICATION)
      throw new Error('Unknown push job type');
    const { fcmToken, title, body, meta } = job.data;
    return this.firebase.sendPush({ token: fcmToken, title, body, data: meta });
  }
}
