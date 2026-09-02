import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../../common/services/firebase/firebase-services';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private fcmService: FirebaseService) {
    this.logger.log('NotificationService initialized');
  }

  /**
   * Generic handler for different notification types
   */
  async sendNotificationByType(
    type: 'PUSH_NOTIFICATION',
    recipients: { fcmToken: string }[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    switch (type) {
      case 'PUSH_NOTIFICATION':
        return this.sendPushNotification(recipients, title, body, data);

      default:
        throw new Error(`Unsupported notification type: ${type}`);
    }
  }

  /**
   * Send push notification via Firebase Cloud Messaging (FCM)
   */
  private async sendPushNotification(
    recipients: { fcmToken: string }[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const recipient = recipients[0];

    if (!recipient?.fcmToken) {
      this.logger.warn('No valid FCM token');
      return { success: false };
    }

    return await this.fcmService.sendPush({
      token: recipient.fcmToken,
      title,
      body,
      data,
    });
  }
}
