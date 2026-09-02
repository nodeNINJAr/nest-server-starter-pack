import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EmailJobType } from '../interfaces/queue-job.interface';
import { MailService } from '../../common/services/mail-services';

@Processor('email-queue', {
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000,
  },
})
@Injectable()
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    this.logger.log(`Attempt ${job.attemptsMade + 1} of ${job.opts?.attempts ?? 1}`);

    switch (job.name) {
      case EmailJobType.WELCOME_EMAIL:
        return await this.handleWelcomeEmail(job);

      case EmailJobType.OTP_EMAIL:
        return await this.handleOtpEmail(job);

      case EmailJobType.PASSWORD_RESET:
        return await this.handlePasswordReset(job);

      case EmailJobType.ACCOUNT_VERIFICATION:
        return await this.handleVerifyEmail(job);

      case EmailJobType.REFERRAL_BONUS:
        return await this.handleReferralBonus(job);

      case EmailJobType.ANNOUNCEMENT_EMAIL:
        return await this.handleAnnouncementEmail(job);

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  // USER REGISTRATION EMAILS
  private async handleWelcomeEmail(job: Job) {
    const { email, username, referralCode } = job.data;

    try {
      await job.updateProgress(10);

      await this.mailService.sendTemplateMail('welcome-users', email, 'Welcome to !', {
        name: username ?? 'User',
        referralCode: referralCode,
      });

      await job.updateProgress(100);
      this.logger.log(`✅ Welcome email sent successfully to ${email}`);

      return { success: true, email, timestamp: new Date() };
    } catch (error) {
      this.logger.error(`❌ Welcome email failed for ${email}:`, error);
      throw error;
    }
  }

  private async handleOtpEmail(job: Job) {
    const { email, otp, name } = job.data;

    await this.mailService.sendTemplateMail('otp', email, 'Your OTP Verification Code', {
      name: name ?? 'User',
      otp,
    });

    return { success: true };
  }
  //
  private async handleVerifyEmail(job: Job) {
    const { email, name, verificationUrl } = job.data;

    await this.mailService.sendTemplateMail('verify-email', email, 'Verify your email address', {
      name: name ?? 'User',
      verificationUrl,
    });

    return { success: true };
  }

  private async handlePasswordReset(job: Job) {
    const { email, resetLink } = job.data;
    await this.mailService.sendTemplateMail('password-reset', email, 'Reset Your Password', {
      resetLink,
    });
    return { success: true };
  }

  private async handleReferralBonus(job: Job) {
    const { email, username, bonusAmount } = job.data;
    await this.mailService.sendTemplateMail('referral-bonus', email, 'You earned a bonus!', {
      username,
      bonusAmount,
    });
    return { success: true };
  }

  // ANNOUNCEMENTS
  private async handleAnnouncementEmail(job: Job) {
    const { email, title, message, imageUrl } = job.data;

    const text = imageUrl
      ? `<img src="${imageUrl}" alt="" style="max-width:100%;margin-bottom:16px;" />${message}`
      : message;

    await this.mailService.sendTemplateMail('plain-text', email, title, { text });

    return { success: true };
  }

  // EVENT HANDLERS
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`✅ Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job ${job.id} failed after ${job.attemptsMade} attempts:`, error.message);

    const maxAttempts = job.opts?.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `🚨 ALERT: Job ${job.id} exhausted all retries. Manual intervention needed.`,
      );
      // TODO: Send alert to ops team (Slack, PagerDuty, etc.)
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`⚙️ Job ${job.id} is now active`);
  }
}
