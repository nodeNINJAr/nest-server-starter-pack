import { Module } from '@nestjs/common';
import { MailService } from './services/mail-services';
import { SmsCore } from './services/sms-services';

@Module({
  providers: [MailService, SmsCore],
  exports: [MailService, SmsCore],
})
export class CommonModule {}
