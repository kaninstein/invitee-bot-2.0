#!/usr/bin/env node

/**
 * Script para testar a API Blofin e descobrir ID do admin
 */

const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Configurações da API Blofin
const BLOFIN_CONFIG = {
  apiKey: 'ea75ea000d4a4f049a0ae9f197ae56c3',
  secretKey: '42b1ad7e2b7a4a239b0d45425b1da2f0',
  passphrase: 'blofin_api_2024',
  baseUrl: 'https://openapi.blofin.com',
  referralCode: 'GoEEO9'
};

/**
 * Gerar assinatura para API Blofin
 */
function generateSignature(method, path, body = '') {
  const timestamp = Date.now().toString();
  const nonce = uuidv4();
  
  // Formato: requestPath + method + timestamp + nonce + body
  const prehash = path + method + timestamp + nonce + body;
  
  // Gerar HMAC-SHA256
  const hexSignature = crypto
    .createHmac('sha256', BLOFIN_CONFIG.secretKey)
    .update(prehash)
    .digest('hex');
  
  // Converter para Base64
  const signature = Buffer.from(hexSignature, 'utf8').toString('base64');
  
  return {
    signature,
    timestamp,
    nonce
  };
}

/**
 * Fazer requisição para API Blofin
 */
async function blofinRequest(method, path, data = null) {
  const body = data ? JSON.stringify(data) : '';
  const { signature, timestamp, nonce } = generateSignature(method, path, body);
  
  const headers = {
    'Content-Type': 'application/json',
    'ACCESS-KEY': BLOFIN_CONFIG.apiKey,
    'ACCESS-SIGN': signature,
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-NONCE': nonce,
    'ACCESS-PASSPHRASE': BLOFIN_CONFIG.passphrase,
  };

  try {
    const response = await axios({
      method,
      url: BLOFIN_CONFIG.baseUrl + path,
      headers,
      data: data ? data : undefined,
      timeout: 15000
    });

    return response.data;
  } catch (error) {
    console.error(`❌ Erro na requisição ${method} ${path}:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

/**
 * Testar endpoints da API
 */
async function testBlofinAPI() {
  console.log('🔍 Testando API Blofin...\n');

  try {
    // 1. Testar informações básicas do afiliado
    console.log('1️⃣ Testando informações básicas do afiliado...');
    const basicInfo = await blofinRequest('GET', '/api/v1/affiliate/basic');
    console.log('✅ Informações básicas:', {
      referralCode: basicInfo.data?.referralCode,
      referralLink: basicInfo.data?.referralLink,
      directInvitees: basicInfo.data?.directInvitees,
      totalCommission: basicInfo.data?.totalCommission
    });

    // 2. Testar informações do código de referência
    console.log('\n2️⃣ Testando informações do código de referência...');
    const referralInfo = await blofinRequest('GET', '/api/v1/affiliate/referral-code');
    console.log('✅ Código de referência:', {
      codes: referralInfo.data?.length || 0,
      defaultCode: referralInfo.data?.[0]?.referralCode,
      defaultLink: referralInfo.data?.[0]?.referralLink
    });

    // 3. Testar lista de convidados diretos
    console.log('\n3️⃣ Testando lista de convidados diretos...');
    const invitees = await blofinRequest('GET', '/api/v1/affiliate/invitees?limit=10');
    console.log('✅ Convidados diretos:', {
      total: invitees.data?.length || 0,
      primeiros3: invitees.data?.slice(0, 3).map(inv => ({
        uid: inv.uid,
        registerTime: new Date(parseInt(inv.registerTime)).toLocaleString('pt-BR'),
        totalTradingVolume: inv.totalTradingVolume,
        kycLevel: inv.kycLevel
      })) || []
    });

    // 4. Gerar link de referência
    console.log('\n4️⃣ Gerando links de referência...');
    const baseLink = `https://blofin.com/register?referral_code=${BLOFIN_CONFIG.referralCode}`;
    const telegramLink = `${baseLink}&source=telegram_test`;
    console.log('✅ Links gerados:');
    console.log('   Base:', baseLink);
    console.log('   Telegram:', telegramLink);

    console.log('\n🎉 Todos os testes da API Blofin passaram!');
    return true;

  } catch (error) {
    console.error('\n❌ Falha nos testes da API Blofin:', error.message);
    return false;
  }
}

/**
 * Descobrir ID do usuário do Telegram
 */
function discoverTelegramId() {
  console.log('\n🔍 Para descobrir seu ID do Telegram:');
  console.log('1. Envie uma mensagem para @userinfobot no Telegram');
  console.log('2. Copie seu User ID');
  console.log('3. Adicione no arquivo src/bot/commands/admin.ts na linha:');
  console.log('   const ADMIN_IDS = ["SEU_ID_AQUI"];');
  console.log('\n💡 Exemplo: se seu ID for 123456789:');
  console.log('   const ADMIN_IDS = ["123456789"];');
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando testes do Bot Telegram - Blofin Integration\n');

  // Testar API Blofin
  const blofinOk = await testBlofinAPI();
  
  if (blofinOk) {
    console.log('\n✅ Configuração da API Blofin está funcionando!');
  } else {
    console.log('\n❌ Problemas com a configuração da API Blofin');
    console.log('   Verifique as credenciais no arquivo .env');
    process.exit(1);
  }

  // Instruções para descobrir ID do Telegram
  discoverTelegramId();

  console.log('\n📋 Próximos passos:');
  console.log('1. ✅ API Blofin configurada');
  console.log('2. ⏳ Descobrir seu ID do Telegram (@userinfobot)');
  console.log('3. ⏳ Adicionar ID ao arquivo admin.ts');
  console.log('4. ⏳ Fazer deploy no Easypanel');
  console.log('5. ⏳ Testar bot em produção');

  console.log('\n🎯 Bot está pronto para deploy!');
}

// Executar script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { blofinRequest, generateSignature };