import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { Twilio } from 'twilio';

@Injectable()
export class SmsCore {
  private client?: Twilio;
  constructor(private readonly config: ConfigService) {}
  async send({ to, message }: { to: string; message: string }) {
    const sid = this.config.get<string>('TWILIO_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_PHONE');
    if (!sid || !token || !from)
      throw new ServiceUnavailableException('SMS delivery is not configured');
    this.client ??= twilio(sid, token, { timeout: 15000 });
    const result = await this.client.messages.create({
      to,
      from,
      body: message,
    });
    return { success: true, sid: result.sid, status: result.status };
  }
}
