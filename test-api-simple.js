#!/usr/bin/env node

// Teste simples da API Blofin
const https = require('https');
const crypto = require('crypto');

// Configurações da API Blofin (do arquivo existente)
const BLOFIN_CONFIG = {
  apiKey: 'ea75ea000d4a4f049a0ae9f197ae56c3',
  secretKey: '42b1ad7e2b7a4a239b0d45425b1da2f0',
  passphrase: 'blofin_api_2024',
  baseUrl: 'https://openapi.blofin.com',
  referralCode: 'blofin'
};

// Gerar UUID simples
function generateSimpleUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Gerar assinatura
function generateSignature(method, path, body = '') {
  const timestamp = Date.now().toString();
  const nonce = generateSimpleUuid();
  
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

// Fazer requisição HTTPS
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : '';
    const { signature, timestamp, nonce } = generateSignature(method, path, body);
    
    const options = {
      hostname: 'openapi.blofin.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'ACCESS-KEY': BLOFIN_CONFIG.apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-NONCE': nonce,
        'ACCESS-PASSPHRASE': BLOFIN_CONFIG.passphrase,
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

// Testar API
async function testAPI() {
  console.log('🔍 Testando API Blofin...\n');

  try {
    // 1. Testar endpoint público primeiro
    console.log('1️⃣ Testando endpoint público...');
    const publicResponse = await makeRequest('GET', '/api/v1/market/tickers?instId=BTC-USDT');
    console.log('✅ Endpoint público:', {
      status: publicResponse.status,
      success: publicResponse.data.code === '0'
    });

    // 2. Testar informações básicas do afiliado
    console.log('\n2️⃣ Testando informações básicas do afiliado...');
    const basicInfo = await makeRequest('GET', '/api/v1/affiliate/basic');
    
    console.log('📊 Resposta da API:', {
      status: basicInfo.status,
      code: basicInfo.data.code,
      message: basicInfo.data.msg
    });

    if (basicInfo.data.code === 200) {
      console.log('✅ API autenticada com sucesso!');
      console.log('📈 Dados do afiliado:', {
        referralCode: basicInfo.data.data?.referralCode || 'N/A',
        directInvitees: basicInfo.data.data?.directInvitees || 0,
        totalCommission: basicInfo.data.data?.totalCommission || '0'
      });
    } else {
      console.log('❌ Erro na autenticação:', basicInfo.data);
    }

    // 3. Testar lista de convidados
    console.log('\n3️⃣ Testando lista de convidados...');
    const invitees = await makeRequest('GET', '/api/v1/affiliate/invitees?limit=5');
    
    console.log('📊 Resposta dos convidados:', {
      status: invitees.status,
      code: invitees.data.code,
      totalInvitees: Array.isArray(invitees.data.data) ? invitees.data.data.length : 0
    });

    console.log('\n🎉 Teste da API concluído!');
    return true;

  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    return false;
  }
}

// Executar teste
testAPI().then((success) => {
  if (success) {
    console.log('\n✅ API Blofin está funcionando!');
  } else {
    console.log('\n❌ Problemas com a API Blofin');
  }
  process.exit(success ? 0 : 1);
});