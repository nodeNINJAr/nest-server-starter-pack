import { OnWorkerEvent, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

export abstract class LoggedWorker extends WorkerHost {
  private readonly logger = new Logger(this.constructor.name);
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(
      `Job ${job?.id ?? 'unknown'} failed (attempt ${job?.attemptsMade ?? 0}): ${error.message}`,
    );
  }
  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error(`Worker error: ${error.message}`);
  }
}
