#!/usr/bin/env node

/**
 * Script para testar se as variáveis de ambiente estão sendo carregadas corretamente
 */

// Carregar dotenv para desenvolvimento local
require('dotenv').config();

console.log('🔍 Testando carregamento das variáveis de ambiente...\n');

// Testar todas as variáveis necessárias
const requiredEnvVars = {
  // Telegram
  'TELEGRAM_BOT_TOKEN': process.env.TELEGRAM_BOT_TOKEN,
  'TELEGRAM_GROUP_ID': process.env.TELEGRAM_GROUP_ID,
  'TELEGRAM_WEBHOOK_URL': process.env.TELEGRAM_WEBHOOK_URL,
  
  // Blofin
  'BLOFIN_API_KEY': process.env.BLOFIN_API_KEY,
  'BLOFIN_SECRET_KEY': process.env.BLOFIN_SECRET_KEY,
  'BLOFIN_PASSPHRASE': process.env.BLOFIN_PASSPHRASE,
  'BLOFIN_BASE_URL': process.env.BLOFIN_BASE_URL,
  'YOUR_REFERRAL_CODE': process.env.YOUR_REFERRAL_CODE,
  
  // Database
  'DATABASE_URL': process.env.DATABASE_URL,
  'REDIS_URL': process.env.REDIS_URL,
  
  // App
  'NODE_ENV': process.env.NODE_ENV,
  'TEST_MODE': process.env.TEST_MODE,
  'DISABLE_RATE_LIMIT': process.env.DISABLE_RATE_LIMIT,
  'PORT': process.env.PORT,
  'JWT_SECRET': process.env.JWT_SECRET,
  'ENCRYPTION_KEY': process.env.ENCRYPTION_KEY,
  
  // Rate Limit
  'RATE_LIMIT_WINDOW_MS': process.env.RATE_LIMIT_WINDOW_MS,
  'RATE_LIMIT_MAX_REQUESTS': process.env.RATE_LIMIT_MAX_REQUESTS,
  
  // Bot
  'VERIFICATION_TIMEOUT_HOURS': process.env.VERIFICATION_TIMEOUT_HOURS,
  'MAX_VERIFICATION_ATTEMPTS': process.env.MAX_VERIFICATION_ATTEMPTS,
};

let hasErrors = false;

console.log('📋 Verificando variáveis de ambiente:\n');

Object.entries(requiredEnvVars).forEach(([key, value]) => {
  const status = value ? '✅' : '❌';
  const displayValue = value ? 
    (key.includes('SECRET') || key.includes('TOKEN') || key.includes('PASSWORD') ? 
      value.substring(0, 8) + '...' : value) : 
    'UNDEFINED';
  
  console.log(`${status} ${key}: ${displayValue}`);
  
  if (!value && !['TELEGRAM_WEBHOOK_URL', 'BLOFIN_BASE_URL'].includes(key)) {
    hasErrors = true;
  }
});

console.log('\n🔧 Configurações calculadas:');
console.log(`✅ TEST_MODE: ${process.env.TEST_MODE === 'true' || process.env.DISABLE_RATE_LIMIT === 'true'}`);
console.log(`✅ Rate limiting disabled: ${process.env.NODE_ENV === 'development' || process.env.DISABLE_RATE_LIMIT === 'true' || process.env.TEST_MODE === 'true'}`);

if (hasErrors) {
  console.log('\n❌ Algumas variáveis de ambiente críticas estão faltando!');
  console.log('   Verifique a configuração no Easypanel.');
  process.exit(1);
} else {
  console.log('\n✅ Todas as variáveis de ambiente estão configuradas!');
}

// Testar conexões
console.log('\n🔍 Testando formato das URLs...');

if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    console.log(`✅ DATABASE_URL: ${dbUrl.protocol}//${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname}`);
  } catch (e) {
    console.log(`❌ DATABASE_URL formato inválido: ${e.message}`);
    hasErrors = true;
  }
}

if (process.env.REDIS_URL) {
  try {
    const redisUrl = new URL(process.env.REDIS_URL);
    console.log(`✅ REDIS_URL: ${redisUrl.protocol}//${redisUrl.hostname}:${redisUrl.port}`);
  } catch (e) {
    console.log(`❌ REDIS_URL formato inválido: ${e.message}`);
    hasErrors = true;
  }
}

// Validações específicas
console.log('\n🔍 Validações específicas...');

if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length !== 32) {
  console.log(`❌ ENCRYPTION_KEY deve ter exatamente 32 caracteres (atual: ${process.env.ENCRYPTION_KEY.length})`);
  hasErrors = true;
} else if (process.env.ENCRYPTION_KEY) {
  console.log(`✅ ENCRYPTION_KEY tem o tamanho correto (32 caracteres)`);
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.log(`⚠️  JWT_SECRET deveria ter pelo menos 32 caracteres (atual: ${process.env.JWT_SECRET.length})`);
} else if (process.env.JWT_SECRET) {
  console.log(`✅ JWT_SECRET tem tamanho adequado`);
}

if (hasErrors) {
  console.log('\n❌ Há problemas na configuração!');
  process.exit(1);
} else {
  console.log('\n🎉 Configuração está correta para deploy!');
}