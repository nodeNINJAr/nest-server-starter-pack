import { Injectable, Logger } from '@nestjs/common';
import admin, { isFirebaseConfigured } from '../../../config/firebase/firebase-config';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  async sendPush({
    token,
    title,
    body,
    data,
  }: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  }) {
    if (!isFirebaseConfigured) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT is not set — skipping push notification');
      throw new Error('Firebase is not configured'); // important for queue retry
    }

    if (!token) {
      this.logger.warn('No FCM token provided');
      throw new Error('Missing FCM token'); // important for queue retry
    }

    //  FCM requires string values in data
    const normalizedData =
      data && Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

    const pushMessage: admin.messaging.Message = {
      token,
      notification: { title, body },
      data: normalizedData || {},
    };

    try {
      const res = await admin.messaging().send(pushMessage);

      this.logger.log(`Push sent | token=${token}`);
      return {
        success: true,
        messageId: res,
      };
    } catch (error) {
      this.logger.error(`Push failed | token=${token}`, error);

      // MUST throw → so BullMQ retry works
      throw error;
    }
  }
}
