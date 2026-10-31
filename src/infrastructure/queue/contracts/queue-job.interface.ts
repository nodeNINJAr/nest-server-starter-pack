export enum EmailJobType {
  WELCOME_EMAIL = 'welcome-email',
  OTP_EMAIL = 'otp',
  PASSWORD_RESET = 'password-reset',
  REFERRAL_BONUS = 'referral-bonus',
  ACCOUNT_VERIFICATION = 'account-verification',
  ANNOUNCEMENT_EMAIL = 'announcement-email',
}
export enum NotificationJobType {
  PUSH_NOTIFICATION = 'push-notification',
}

export interface EmailPayloads {
  [EmailJobType.WELCOME_EMAIL]: {
    userId: string;
    email: string;
    username?: string;
    referralCode?: string;
  };
  [EmailJobType.OTP_EMAIL]: { email: string; otp: string; name?: string };
  [EmailJobType.PASSWORD_RESET]: {
    email: string;
    name?: string;
    resetLink: string;
  };
  [EmailJobType.REFERRAL_BONUS]: {
    email: string;
    username?: string;
    bonusAmount: number;
  };
  [EmailJobType.ACCOUNT_VERIFICATION]: {
    email: string;
    name?: string;
    verificationUrl: string;
  };
  [EmailJobType.ANNOUNCEMENT_EMAIL]: {
    email: string;
    title: string;
    message: string;
    imageUrl?: string;
  };
}
export interface PushPayload {
  userId: string;
  fcmToken: string;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
}
export type SmsPayload =
  | { to: string; otp: string; name: string; trigger: string; type: 'sms_otp' }
  | { to: string; message: string; type: 'sms_notification' };
