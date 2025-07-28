#!/usr/bin/env node

/**
 * Script de diagnóstico para ser executado no container do Easypanel
 * Para verificar se as variáveis de ambiente estão sendo carregadas corretamente
 */

console.log('🔧 DIAGNÓSTICO DE VARIÁVEIS DE AMBIENTE - EASYPANEL');
console.log('=' .repeat(60));

// Informações do sistema
console.log('\n📊 INFORMAÇÕES DO SISTEMA:');
console.log(`Node.js: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Working Directory: ${process.cwd()}`);

// Verificar se existem arquivos .env
const fs = require('fs');
const path = require('path');

console.log('\n📁 ARQUIVOS .env:');
const envFiles = ['.env', '.env.local', '.env.production'];
envFiles.forEach(file => {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  console.log(`${exists ? '✅' : '❌'} ${file}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
});

// Todas as variáveis esperadas
const expectedVars = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_GROUP_ID', 
  'TELEGRAM_WEBHOOK_URL',
  'BLOFIN_API_KEY',
  'BLOFIN_SECRET_KEY',
  'BLOFIN_PASSPHRASE',
  'BLOFIN_BASE_URL',
  'YOUR_REFERRAL_CODE',
  'DATABASE_URL',
  'REDIS_URL',
  'NODE_ENV',
  'TEST_MODE',
  'DISABLE_RATE_LIMIT',
  'PORT',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX_REQUESTS',
  'VERIFICATION_TIMEOUT_HOURS',
  'MAX_VERIFICATION_ATTEMPTS'
];

console.log('\n🔍 VARIÁVEIS DE AMBIENTE:');
console.log('-'.repeat(60));

let missingVars = [];
let hasErrors = false;

expectedVars.forEach(varName => {
  const value = process.env[varName];
  const exists = value !== undefined && value !== '';
  
  if (!exists) {
    missingVars.push(varName);
    hasErrors = true;
  }
  
  let displayValue = 'UNDEFINED';
  if (exists) {
    if (varName.includes('SECRET') || varName.includes('TOKEN') || varName.includes('PASSWORD')) {
      displayValue = value.substring(0, 8) + '...';
    } else if (varName.includes('URL') && value.length > 50) {
      displayValue = value.substring(0, 30) + '...';
    } else {
      displayValue = value;
    }
  }
  
  console.log(`${exists ? '✅' : '❌'} ${varName.padEnd(25)} = ${displayValue}`);
});

// Configurações calculadas
console.log('\n⚙️  CONFIGURAÇÕES CALCULADAS:');
console.log('-'.repeat(60));

const testMode = process.env.TEST_MODE === 'true' || process.env.DISABLE_RATE_LIMIT === 'true';
const rateLimitDisabled = process.env.NODE_ENV === 'development' || 
                         process.env.DISABLE_RATE_LIMIT === 'true' || 
                         process.env.TEST_MODE === 'true';

console.log(`✅ TEST_MODE: ${testMode}`);
console.log(`✅ Rate limiting disabled: ${rateLimitDisabled}`);
console.log(`✅ Environment: ${process.env.NODE_ENV || 'undefined'}`);

// Validações específicas
console.log('\n🔧 VALIDAÇÕES ESPECÍFICAS:');
console.log('-'.repeat(60));

if (process.env.ENCRYPTION_KEY) {
  const isValid = process.env.ENCRYPTION_KEY.length === 32;
  console.log(`${isValid ? '✅' : '❌'} ENCRYPTION_KEY length: ${process.env.ENCRYPTION_KEY.length} (required: 32)`);
  if (!isValid) hasErrors = true;
} else {
  console.log('❌ ENCRYPTION_KEY: Missing');
  hasErrors = true;
}

if (process.env.JWT_SECRET) {
  const isValid = process.env.JWT_SECRET.length >= 32;
  console.log(`${isValid ? '✅' : '⚠️ '} JWT_SECRET length: ${process.env.JWT_SECRET.length} (recommended: >=32)`);
} else {
  console.log('❌ JWT_SECRET: Missing');
  hasErrors = true;
}

// URLs validation
console.log('\n🌐 VALIDAÇÃO DE URLs:');
console.log('-'.repeat(60));

if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`✅ DATABASE_URL: ${url.protocol}//${url.hostname}:${url.port}${url.pathname}`);
  } catch (e) {
    console.log(`❌ DATABASE_URL: Invalid format - ${e.message}`);
    hasErrors = true;
  }
} else {
  console.log('❌ DATABASE_URL: Missing');
  hasErrors = true;
}

if (process.env.REDIS_URL) {
  try {
    const url = new URL(process.env.REDIS_URL);
    console.log(`✅ REDIS_URL: ${url.protocol}//${url.hostname}:${url.port}`);
  } catch (e) {
    console.log(`❌ REDIS_URL: Invalid format - ${e.message}`);
    hasErrors = true;
  }
} else {
  console.log('❌ REDIS_URL: Missing');
  hasErrors = true;
}

// Resultado final
console.log('\n' + '='.repeat(60));
if (hasErrors || missingVars.length > 0) {
  console.log('❌ DIAGNÓSTICO: PROBLEMAS ENCONTRADOS');
  if (missingVars.length > 0) {
    console.log(`\n📋 Variáveis ausentes (${missingVars.length}):`);
    missingVars.forEach(varName => console.log(`   - ${varName}`));
  }
  console.log('\n🔧 AÇÕES NECESSÁRIAS:');
  console.log('1. Verificar configuração das variáveis no Easypanel');
  console.log('2. Garantir que não há comentários nas linhas das variáveis');
  console.log('3. Reiniciar o container após ajustes');
  process.exit(1);
} else {
  console.log('✅ DIAGNÓSTICO: CONFIGURAÇÃO CORRETA');
  console.log('\n🎉 Todas as variáveis estão configuradas corretamente!');
  console.log('   O bot está pronto para funcionar.');
}

console.log('=' .repeat(60));