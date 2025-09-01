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

function getEnvVarWithDefault(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
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
    baseUrl: getEnvVarWithDefault('BLOFIN_BASE_URL', 'https://openapi.blofin.com'),
    referralCode: getEnvVar('YOUR_REFERRAL_CODE'),
  },
  database: {
    url: getEnvVarWithDefault('DATABASE_URL', 'postgresql://postgres:postgres@postgres:5432/invitee_bot'),
  },
  redis: {
    url: getEnvVarWithDefault('REDIS_URL', 'redis://default:redis@redis:6379'),
  },
  app: {
    port: getEnvNumber('PORT', 3000),
    nodeEnv: getEnvVarWithDefault('NODE_ENV', 'production'),
    jwtSecret: getEnvVarWithDefault('JWT_SECRET', 'inviteebot2024secretkeyforjwttoken'),
    encryptionKey: getEnvVarWithDefault('ENCRYPTION_KEY', 'inviteebot2024encryptkey32chars1'),
    testMode: process.env.TEST_MODE === 'true' || process.env.DISABLE_RATE_LIMIT === 'true',
  },
  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutos
    maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  },
  bot: {
    verificationTimeoutHours: getEnvNumber('VERIFICATION_TIMEOUT_HOURS', 24),
    maxVerificationAttempts: getEnvNumber('MAX_VERIFICATION_ATTEMPTS', 3),
    loomTutorialUrl: getEnvVarWithDefault('LOOM_TUTORIAL_URL', 'https://www.loom.com/share/your-uid-tutorial'),
  },
};

export function validateConfig(): void {
  console.log('🔍 Validating configuration...');
  
  // Only validate critical configurations (Telegram and Blofin APIs)
  const criticalConfigs = [
    'telegram.botToken',
    'telegram.groupId', 
    'blofin.apiKey',
    'blofin.secretKey',
    'blofin.passphrase',
    'blofin.referralCode',
  ];

  const missingConfigs = [];
  for (const configPath of criticalConfigs) {
    const value = configPath.split('.').reduce((obj, key) => obj[key], config as any);
    if (!value || value === 'your_telegram_bot_token_here' || value === 'your_blofin_api_key' || value === '-100XXXXXXXXX' || value === 'your_referral_code') {
      missingConfigs.push(configPath);
    }
  }

  if (missingConfigs.length > 0) {
    console.log('⚠️  CONFIGURAÇÃO PENDENTE - Configure as seguintes variáveis:');
    for (const config of missingConfigs) {
      console.log(`   ❌ ${config.toUpperCase()}`);
    }
    console.log('\n📝 Edite o arquivo .env com as credenciais corretas:');
    console.log('   • TELEGRAM_BOT_TOKEN (do @BotFather)');
    console.log('   • TELEGRAM_GROUP_ID (ID do grupo)');
    console.log('   • BLOFIN_API_KEY, BLOFIN_SECRET_KEY, BLOFIN_PASSPHRASE (da Blofin)');
    console.log('   • YOUR_REFERRAL_CODE (seu código de afiliado)');
    console.log('\n🚀 PostgreSQL e Redis já estão pré-configurados para Easypanel!');
    
    // Don't throw error, just warn - let the app start so user can see the message
    console.log('\n⚠️  Bot iniciará, mas não funcionará até configurar as credenciais acima.');
  } else {
    console.log('✅ Configuration validated successfully');
  }

  // Validate encryption key length (should be 32 characters for AES-256)
  if (config.app.encryptionKey.length !== 32) {
    console.warn('⚠️  ENCRYPTION_KEY should be exactly 32 characters long, using default');
  }

  // Validate JWT secret length  
  if (config.app.jwtSecret.length < 32) {
    console.warn('⚠️  JWT_SECRET should be at least 32 characters long, using default');
  }

  console.log('🌐 Database: ' + (config.database.url.includes('postgres:5432') ? 'Easypanel PostgreSQL ✅' : 'Custom PostgreSQL'));
  console.log('🔴 Redis: ' + (config.redis.url.includes('redis:6379') ? 'Easypanel Redis ✅' : 'Custom Redis'));
}