import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/datasource/prisma.service';
import { QueueService } from './main-queue.services';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Fans a push job out to every active device registered for the user.
   */
  async notifyUser(userId: string, title: string, body: string, meta?: Record<string, any>) {
    try {
      const devices = await this.prisma.userDevice.findMany({
        where: { userId, isActive: true },
        select: { deviceToken: true },
      });

      for (const device of devices) {
        await this.queueService.queuePushNotification({
          userId,
          fcmToken: device.deviceToken,
          title,
          body,
          meta,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Push notification failed | user=${userId} | ${message}`);
    }
  }
}
