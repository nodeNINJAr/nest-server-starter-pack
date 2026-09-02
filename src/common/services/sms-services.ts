import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { Twilio } from 'twilio';

@Injectable()
export class SmsCore {
  private client: Twilio;

  constructor(private readonly configService: ConfigService) {
    this.client = twilio(
      this.configService.get<string>('TWILIO_SID'),
      this.configService.get<string>('TWILIO_AUTH_TOKEN'),
    );
  }

  async send({ to, message }: { to: string; message: string }) {
    try {
      const res = await this.client.messages.create({
        to,
        from: this.configService.get<string>('TWILIO_PHONE'),
        body: message,
      });

      return {
        success: true,
        sid: res.sid,
        status: res.status,
      };
    } catch (error) {
      throw new Error(`Twilio SMS failed: ${error}`);
    }
  }
}
