import dotenv from 'dotenv';
import { Config } from '../types';

dotenv.config();

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function getEnvNumber(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value ? parseInt(value, 10) : defaultValue!;
}

export const config: Config = {
  telegram: {
    botToken: getEnvVar('TELEGRAM_BOT_TOKEN'),
    groupId: getEnvVar('TELEGRAM_GROUP_ID'),
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
  },
  blofin: {
    apiKey: getEnvVar('BLOFIN_API_KEY'),
    secretKey: getEnvVar('BLOFIN_SECRET_KEY'),
    passphrase: getEnvVar('BLOFIN_PASSPHRASE'),
    baseUrl: getEnvVar('BLOFIN_BASE_URL', 'https://openapi.blofin.com'),
    referralCode: getEnvVar('YOUR_REFERRAL_CODE'),
  },
  database: {
    url: getEnvVar('DATABASE_URL'),
  },
  redis: {
    url: getEnvVar('REDIS_URL'),
  },
  app: {
    port: getEnvNumber('PORT', 3000),
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    jwtSecret: getEnvVar('JWT_SECRET'),
    encryptionKey: getEnvVar('ENCRYPTION_KEY'),
  },
  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutos
    maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  },
  bot: {
    verificationTimeoutHours: getEnvNumber('VERIFICATION_TIMEOUT_HOURS', 24),
    maxVerificationAttempts: getEnvNumber('MAX_VERIFICATION_ATTEMPTS', 3),
  },
};

export function validateConfig(): void {
  console.log('🔍 Validating configuration...');
  
  // Validate required configurations
  const requiredConfigs = [
    'telegram.botToken',
    'telegram.groupId',
    'blofin.apiKey',
    'blofin.secretKey',
    'blofin.passphrase',
    'database.url',
    'redis.url',
    'app.jwtSecret',
    'app.encryptionKey',
  ];

  for (const configPath of requiredConfigs) {
    const value = configPath.split('.').reduce((obj, key) => obj[key], config as any);
    if (!value) {
      throw new Error(`Configuration ${configPath} is missing or empty`);
    }
  }

  // Validate encryption key length (should be 32 characters for AES-256)
  if (config.app.encryptionKey.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
  }

  // Validate JWT secret length
  if (config.app.jwtSecret.length < 32) {
    console.warn('⚠️  JWT_SECRET should be at least 32 characters long for security');
  }

  console.log('✅ Configuration validated successfully');
}