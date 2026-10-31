import { Module } from '@nestjs/common';
import { QueueModule } from './queue.module';
import { EmailProcessor } from './processors/email.processor';
import { NotificationProcessor } from './processors/push.processor';
import { SmsProcessor } from './processors/sms.processor';
import { MailService } from '../messaging/mail/mail.service';
import { SmsCore } from '../messaging/sms/sms.service';
import { FirebaseService } from '../messaging/push/firebase.service';

@Module({
  imports: [QueueModule],
  providers: [
    EmailProcessor,
    NotificationProcessor,
    SmsProcessor,
    MailService,
    SmsCore,
    FirebaseService,
  ],
})
export class WorkersModule {}
