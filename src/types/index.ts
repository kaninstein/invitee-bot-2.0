export interface User {
  id: number;
  telegram_id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  referral_token: string;
  blofin_verified: boolean;
  group_access: boolean;
  verification_attempts: number;
  created_at: Date;
  updated_at: Date;
}

export interface BlofinApiResponse {
  code: number;
  msg: string;
  data: any;
}

export interface BlofinInvitee {
  uid: string;
  email?: string;
  mobile?: string;
  registerTime: string;
  level: number;
  rebateRate: string;
}

export interface VerificationSession {
  user_id: number;
  referral_token: string;
  expires_at: Date;
  attempts: number;
}

export interface BotContext {
  user?: User;
  session?: VerificationSession;
}

export interface Config {
  telegram: {
    botToken: string;
    groupId: string;
    webhookUrl?: string;
  };
  blofin: {
    apiKey: string;
    secretKey: string;
    passphrase: string;
    baseUrl: string;
    referralCode: string;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  app: {
    port: number;
    nodeEnv: string;
    jwtSecret: string;
    encryptionKey: string;
    testMode: boolean;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  bot: {
    verificationTimeoutHours: number;
    maxVerificationAttempts: number;
  };
}