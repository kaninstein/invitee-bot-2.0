#!/usr/bin/env node

/**
 * Script para testar a API Blofin e descobrir ID do admin
 */

const axios = require('axios');
const CryptoJS = require('crypto-js');
const { v4: uuidv4 } = require('uuid');

// Use your actual credentials
const API_KEY = '47d6533ad3054856916bf39117c1582b';
const SECRET_KEY = '489bdb99ba54465e88fdc251dc4c3a75';
const PASSPHRASE = 'XandyMoney1063';
const BASE_URL = 'https://openapi.blofin.com';

async function testBlofinAPI() {
  try {
    console.log('🧪 Testing Blofin API Authentication...\n');
    
    // Test 1: Basic affiliate info
    console.log('📊 Test 1: Getting affiliate basic info...');
    const basicInfo = await makeAuthenticatedRequest('GET', '/api/v1/affiliate/basic');
    console.log('✅ Basic Info Response:', {
      code: basicInfo.code,
      msg: basicInfo.msg,
      hasData: !!basicInfo.data
    });
    
    // Test 2: Direct invitees without UID
    console.log('\n📊 Test 2: Getting direct invitees (general list)...');
    const invitees = await makeAuthenticatedRequest('GET', '/api/v1/affiliate/invitees', { limit: 10 });
    console.log('✅ Invitees Response:', {
      code: invitees.code,
      msg: invitees.msg,
      dataType: typeof invitees.data,
      dataLength: Array.isArray(invitees.data) ? invitees.data.length : 'not array'
    });
    
    if (Array.isArray(invitees.data) && invitees.data.length > 0) {
      console.log('📋 Sample invitee:', invitees.data[0]);
    }
    
    // Test 3: Search for specific UID
    const testUid = '23176549948';
    console.log(`\n📊 Test 3: Searching for UID ${testUid}...`);
    const specificUser = await makeAuthenticatedRequest('GET', '/api/v1/affiliate/invitees', { 
      uid: testUid,
      limit: 1 
    });
    console.log('✅ Specific UID Response:', {
      code: specificUser.code,
      msg: specificUser.msg,
      dataType: typeof specificUser.data,
      dataLength: Array.isArray(specificUser.data) ? specificUser.data.length : 'not array'
    });
    
    // Test 4: Check if UID exists in general list
    if (Array.isArray(invitees.data)) {
      const found = invitees.data.find(user => String(user.uid) === String(testUid));
      console.log(`🔍 UID ${testUid} found in general list:`, !!found);
      if (found) {
        console.log('👤 Found user details:', found);
      }
    }
    
  } catch (error) {
    console.error('❌ API Test Error:', error.message);
    if (error.response) {
      console.error('📄 Response data:', error.response.data);
      console.error('📊 Response status:', error.response.status);
    }
  }
}

async function makeAuthenticatedRequest(method, path, params = {}) {
  const timestamp = Date.now().toString();
  const nonce = uuidv4();
  
  // Build URL with query parameters for GET requests
  let fullPath = path;
  if (method === 'GET' && Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString();
    fullPath += '?' + queryString;
  }
  
  const body = method === 'GET' ? '' : JSON.stringify(params);
  
  // Create signature string: path + method + timestamp + nonce + body
  const prehash = fullPath + method + timestamp + nonce + body;
  
  // Generate HMAC-SHA256 signature and convert to base64 (matching Postman exactly)
  const hexSignature = CryptoJS.HmacSHA256(prehash, SECRET_KEY).toString();
  const signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(hexSignature));
  
  console.log(`🔐 Auth Debug:`, {
    method,
    fullPath,
    timestamp,
    nonce: nonce.substring(0, 8) + '...',
    prehashLength: prehash.length,
    signatureLength: signature.length
  });
  
  const headers = {
    'ACCESS-KEY': API_KEY,
    'ACCESS-SIGN': signature,
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-NONCE': nonce,
    'ACCESS-PASSPHRASE': PASSPHRASE,
    'Content-Type': 'application/json'
  };
  
  const config = {
    method,
    url: BASE_URL + path,
    headers
  };
  
  if (method === 'GET' && Object.keys(params).length > 0) {
    config.params = params;
  } else if (method !== 'GET') {
    config.data = params;
  }
  
  const response = await axios(config);
  return response.data;
}

// Run the test
testBlofinAPI();

