import { LoggedWorker } from './logged-worker';
import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService } from '../../messaging/mail/mail.service';
import { EmailJobType, EmailPayloads } from '../contracts/queue-job.interface';

type EmailJob = {
  [K in EmailJobType]: Job<EmailPayloads[K], unknown, K>;
}[EmailJobType];

@Processor('email-queue', {
  concurrency: 5,
  limiter: { max: 10, duration: 1000 },
})
export class EmailProcessor extends LoggedWorker {
  constructor(private readonly mail: MailService) {
    super();
  }
  async process(job: EmailJob) {
    switch (job.name) {
      case EmailJobType.WELCOME_EMAIL:
        await this.mail.sendTemplateMail('welcome-users', job.data.email, 'Welcome!', {
          name: job.data.username ?? 'User',
          referralCode: job.data.referralCode,
        });
        break;
      case EmailJobType.OTP_EMAIL:
        await this.mail.sendTemplateMail('otp', job.data.email, 'Your verification code', {
          name: job.data.name ?? 'User',
          otp: job.data.otp,
        });
        break;
      case EmailJobType.PASSWORD_RESET:
        await this.mail.sendTemplateMail('password-reset', job.data.email, 'Reset your password', {
          resetLink: job.data.resetLink,
        });
        break;
      case EmailJobType.ACCOUNT_VERIFICATION:
        await this.mail.sendTemplateMail(
          'verify-email',
          job.data.email,
          'Verify your email address',
          {
            name: job.data.name ?? 'User',
            verificationUrl: job.data.verificationUrl,
          },
        );
        break;
      case EmailJobType.REFERRAL_BONUS:
        await this.mail.sendTemplateMail('referral-bonus', job.data.email, 'You earned a bonus!', {
          username: job.data.username,
          bonusAmount: job.data.bonusAmount,
        });
        break;
      case EmailJobType.ANNOUNCEMENT_EMAIL:
        await this.mail.sendTemplateMail('plain-text', job.data.email, job.data.title, {
          text: job.data.message,
        });
        break;
      default:
        throw new Error('Unknown email job type');
    }
    return { success: true };
  }
}
