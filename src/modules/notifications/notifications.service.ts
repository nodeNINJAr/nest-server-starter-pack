import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';

/** Feature-level orchestration; infrastructure does not query user tables. */
@Injectable()
export class PushNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}
  async notifyUser(userId: string, title: string, body: string, meta?: Record<string, unknown>) {
    const devices = await this.prisma.userDevice.findMany({
      where: { userId, isActive: true },
      select: { deviceToken: true },
    });
    // Propagate enqueue failures so callers can decide how to recover.
    for (const device of devices) {
      await this.queue.queuePushNotification({
        userId,
        fcmToken: device.deviceToken,
        title,
        body,
        meta,
      });
    }
  }
}
