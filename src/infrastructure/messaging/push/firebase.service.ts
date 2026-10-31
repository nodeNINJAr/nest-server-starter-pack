import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, deleteApp, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class FirebaseService implements OnModuleDestroy {
  private app?: App;
  constructor(private readonly config: ConfigService) {}
  async sendPush({
    token,
    title,
    body,
    data,
  }: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }) {
    if (!token) throw new Error('Missing FCM token');
    if (!this.app) {
      const account = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
      if (!account) throw new ServiceUnavailableException('Push delivery is not configured');
      this.app = initializeApp(
        { credential: cert(JSON.parse(account) as ServiceAccount) },
        'starter-push',
      );
    }
    const messageId = await getMessaging(this.app).send({
      token,
      notification: { title, body },
      data:
        data &&
        Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
    });
    return { success: true, messageId };
  }
  async onModuleDestroy() {
    if (this.app) await deleteApp(this.app);
  }
}
