import { Injectable, Logger } from '@nestjs/common';
import { SmsCore } from '../../common/services/sms-services';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly smsCore: SmsCore) {
    this.logger.log('NotificationService initialized');
  }

  async sendOptMessage(to: string, message: string) {
    await this.smsCore.send({
      to,
      message,
    });
  }
}
