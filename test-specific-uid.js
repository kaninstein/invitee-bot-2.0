const axios = require('axios');
const CryptoJS = require('crypto-js');

// Configuração da API Blofin
const BLOFIN_CONFIG = {
  apiKey: 'ea75ea000d4a4f049a0ae9f197ae56c3',
  secretKey: '42b1ad7e2b7a4a239b0d45425b1da2f0',
  passphrase: 'blofin_api_2024',
  baseUrl: 'https://openapi.blofin.com',
  referralCode: 'GoEEO9'
};

// UID específico para testar
const TEST_UID = '23176549948';

/**
 * Gerar assinatura para API Blofin
 */
function generateSignature(requestPath, method, timestamp, nonce, body = '') {
  const prehash = requestPath + method + timestamp + nonce + body;
  const signature = CryptoJS.HmacSHA256(prehash, BLOFIN_CONFIG.secretKey);
  return CryptoJS.enc.Base64.stringify(signature);
}

/**
 * Fazer requisição autenticada para API Blofin
 */
async function makeAuthenticatedRequest(endpoint, method = 'GET', body = null) {
  try {
    const timestamp = Date.now().toString();
    const nonce = Math.random().toString(36).substring(2, 15);
    const requestPath = `/api/v1${endpoint}`;
    const bodyString = body ? JSON.stringify(body) : '';
    
    const signature = generateSignature(requestPath, method, timestamp, nonce, bodyString);
    
    const headers = {
      'BAPI-API-KEY': BLOFIN_CONFIG.apiKey,
      'BAPI-PASSPHRASE': BLOFIN_CONFIG.passphrase,
      'BAPI-TIMESTAMP': timestamp,
      'BAPI-NONCE': nonce,
      'BAPI-SIGN': signature,
      'Content-Type': 'application/json',
    };

    console.log(`🔍 Fazendo requisição: ${method} ${requestPath}`);
    console.log(`📝 Headers:`, {
      timestamp,
      nonce,
      signature: signature.substring(0, 20) + '...'
    });

    const config = {
      method,
      url: `${BLOFIN_CONFIG.baseUrl}${requestPath}`,
      headers,
      timeout: 15000,
    };

    if (body && method !== 'GET') {
      config.data = body;
    }

    const response = await axios(config);
    return response.data;

  } catch (error) {
    console.error(`❌ Erro na requisição ${endpoint}:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

/**
 * Buscar convidados diretos
 */
async function getDirectInvitees(params = {}) {
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });

  const endpoint = `/affiliate/invitees${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  return await makeAuthenticatedRequest(endpoint);
}

/**
 * Verificar UID específico
 */
async function verifySpecificUid(uid) {
  console.log(`\n🎯 Verificando UID específico: ${uid}`);
  
  try {
    // 1. Buscar por UID específico
    console.log(`\n1️⃣ Busca direta por UID ${uid}...`);
    const directResponse = await getDirectInvitees({ uid: uid, limit: 1 });
    console.log(`📊 Resposta da busca direta:`, directResponse);
    
    if (directResponse.code === 200 && directResponse.data && directResponse.data.length > 0) {
      const user = directResponse.data[0];
      console.log(`✅ UID ${uid} ENCONTRADO na busca direta!`, {
        uid: user.uid,
        registerTime: new Date(parseInt(user.registerTime)).toLocaleString('pt-BR'),
        kycLevel: user.kycLevel,
        totalTradingVolume: user.totalTradingVolume,
        totalTradingFee: user.totalTradingFee,
        totalCommision: user.totalCommision
      });
      return true;
    }
    
    // 2. Buscar em lista geral
    console.log(`\n2️⃣ Busca na lista geral (últimos 100 registros)...`);
    const generalResponse = await getDirectInvitees({ limit: 100 });
    console.log(`📊 Resposta da lista geral:`, {
      code: generalResponse.code,
      totalUsuarios: generalResponse.data?.length || 0
    });
    
    if (generalResponse.code === 200 && generalResponse.data && Array.isArray(generalResponse.data)) {
      console.log(`📋 Primeiros 5 UIDs encontrados:`, 
        generalResponse.data.slice(0, 5).map(u => u.uid)
      );
      
      const userFound = generalResponse.data.find(invitee => invitee.uid === uid);
      
      if (userFound) {
        console.log(`✅ UID ${uid} ENCONTRADO na lista geral!`, {
          uid: userFound.uid,
          registerTime: new Date(parseInt(userFound.registerTime)).toLocaleString('pt-BR'),
          kycLevel: userFound.kycLevel,
          totalTradingVolume: userFound.totalTradingVolume
        });
        return true;
      } else {
        console.log(`❌ UID ${uid} NÃO encontrado na lista geral`);
        console.log(`📋 Todos os UIDs na lista:`, generalResponse.data.map(u => u.uid));
      }
    }
    
    // 3. Buscar registros recentes (últimas 48h)
    console.log(`\n3️⃣ Busca em registros recentes (últimas 48h)...`);
    const now = Date.now();
    const twoDaysAgo = now - (48 * 60 * 60 * 1000);
    
    const recentResponse = await getDirectInvitees({
      begin: twoDaysAgo.toString(),
      end: now.toString(),
      limit: 200
    });
    
    console.log(`📊 Resposta dos registros recentes:`, {
      code: recentResponse.code,
      totalUsuarios: recentResponse.data?.length || 0
    });
    
    if (recentResponse.code === 200 && recentResponse.data && Array.isArray(recentResponse.data)) {
      const recentUser = recentResponse.data.find(invitee => invitee.uid === uid);
      
      if (recentUser) {
        console.log(`✅ UID ${uid} ENCONTRADO nos registros recentes!`, {
          uid: recentUser.uid,
          registerTime: new Date(parseInt(recentUser.registerTime)).toLocaleString('pt-BR'),
          kycLevel: recentUser.kycLevel,
          totalTradingVolume: recentUser.totalTradingVolume
        });
        return true;
      } else {
        console.log(`❌ UID ${uid} NÃO encontrado nos registros recentes`);
      }
    }
    
    console.log(`\n🔍 RESULTADO FINAL: UID ${uid} NÃO foi encontrado em nenhuma busca`);
    return false;
    
  } catch (error) {
    console.error(`❌ Erro ao verificar UID ${uid}:`, error.message);
    return false;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log(`🚀 Testando verificação de UID específico na API Blofin`);
  console.log(`🔧 Configuração:`);
  console.log(`   - Base URL: ${BLOFIN_CONFIG.baseUrl}`);
  console.log(`   - Código Referral: ${BLOFIN_CONFIG.referralCode}`);
  console.log(`   - UID para testar: ${TEST_UID}`);
  
  try {
    const isFound = await verifySpecificUid(TEST_UID);
    
    console.log(`\n🎯 RESULTADO FINAL:`);
    if (isFound) {
      console.log(`✅ UID ${TEST_UID} foi encontrado nos seus afiliados!`);
    } else {
      console.log(`❌ UID ${TEST_UID} NÃO foi encontrado nos seus afiliados.`);
      console.log(`\n💡 Possíveis causas:`);
      console.log(`   1. O usuário não se cadastrou usando seu link de referência`);
      console.log(`   2. O UID está incorreto`);
      console.log(`   3. O cadastro é muito recente e ainda não apareceu na API`);
      console.log(`   4. Problema na configuração da API (chaves incorretas)`);
      console.log(`\n🔗 Link de referência correto:`);
      console.log(`   https://blofin.com/register?referral_code=${BLOFIN_CONFIG.referralCode}`);
    }
    
  } catch (error) {
    console.error(`💥 Erro durante o teste:`, error.message);
  }
}

// Executar teste
main();