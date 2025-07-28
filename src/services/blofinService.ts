import axios, { AxiosInstance, AxiosResponse } from 'axios';
import CryptoJS from 'crypto-js';
import { config } from '../config';
import { BlofinApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

function isSuccessCode(code: any): boolean {
  return code === '0' || code === '200' || parseInt(code) === 0 || parseInt(code) === 200;
}

class BlofinService {
  private client: AxiosInstance;
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly passphrase: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = config.blofin.apiKey;
    this.secretKey = config.blofin.secretKey;
    this.passphrase = config.blofin.passphrase;
    this.baseUrl = config.blofin.baseUrl;

    logger.debug('BLOFIN_SERVICE', `🔐 BLOFIN CONFIG loaded | apiKeyStart=${this.apiKey.substring(0, 8)}, baseUrl=${this.baseUrl}, passphrasePreview=${this.passphrase.substring(0, 3)}***`);

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      const requestId = uuidv4();
      const timestamp = Date.now().toString();
      const nonce = uuidv4();
      const method = config.method?.toUpperCase() || 'GET';
      let requestPath = config.url || '';

      if (config.params && Object.keys(config.params).length > 0) {
        const queryString = new URLSearchParams(config.params).toString();
        requestPath += '?' + queryString;
      }

      const body = config.data ? JSON.stringify(config.data) : '';
      const prehash = requestPath + method + timestamp + nonce + body;

      const hexSignature = CryptoJS.HmacSHA256(prehash, this.secretKey).toString();
      const signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(hexSignature));

      logger.debug('BLOFIN_SERVICE', `🔐 BLOFIN SIGNATURE GENERATED | method=${method}, requestPath=${requestPath}, timestamp=${timestamp}, nonce=${nonce}, prehash=${prehash}, signaturePreview=${signature.substring(0, 12)}..., requestId=${requestId}`);

      config.headers = {
        ...config.headers,
        'ACCESS-KEY': this.apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-NONCE': nonce,
        'ACCESS-PASSPHRASE': this.passphrase,
        'X-REQUEST-ID': requestId,
      } as any;

      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('BLOFIN_SERVICE', `❌ BLOFIN API ERROR | message=${error.message}, url=${error.config?.url}, method=${error.config?.method}`, error as Error);
        throw error;
      }
    );
  }

  async getAffiliateBasicInfo(): Promise<BlofinApiResponse> {
    const response = await this.client.get('/api/v1/affiliate/basic');
    return response.data;
  }

  async getDirectInvitees(params?: any): Promise<BlofinApiResponse> {
    const queryParams = { ...params };
    if (!queryParams.limit) queryParams.limit = 100;
    const response = await this.client.get('/api/v1/affiliate/invitees', { params: queryParams });
    return response.data;
  }

  async verifyUserRegistration(identifier: string): Promise<boolean> {
    const response = await this.getDirectInvitees({ uid: identifier, limit: 1 });
    if (isSuccessCode(response.code) && Array.isArray(response.data) && response.data.length > 0) {
      return true;
    }
    const generalResponse = await this.getDirectInvitees({ limit: 200 });
    return Array.isArray(generalResponse.data) && generalResponse.data.some((u) => u.uid === identifier);
  }

  async verifyRecentRegistration(identifier: string): Promise<boolean> {
    const now = Date.now();
    const begin = now - 48 * 60 * 60 * 1000;
    const response = await this.getDirectInvitees({ begin: begin.toString(), end: now.toString(), limit: 200 });
    return Array.isArray(response.data) && response.data.some((u) => u.uid === identifier);
  }

  async getAffiliateStats(): Promise<BlofinApiResponse> {
    return this.getAffiliateBasicInfo();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.getAffiliateBasicInfo();
      return isSuccessCode(response.code);
    } catch {
      return false;
    }
  }

  generateReferralLink(telegramId?: string): string {
    const referralCode = config.blofin.referralCode;
    let url = `https://blofin.com/register?referral_code=${referralCode}`;
    if (telegramId) url += `&source=telegram_${telegramId}`;
    return url;
  }

  async findUserByUid(uid: string): Promise<any | null> {
    const response = await this.getDirectInvitees({ uid, limit: 1 });
    return isSuccessCode(response.code) && Array.isArray(response.data) && response.data.length > 0
      ? response.data[0]
      : null;
  }

  async getRecentInvitees(hours: number = 48): Promise<any[]> {
    const now = Date.now();
    const begin = now - hours * 60 * 60 * 1000;
    const response = await this.getDirectInvitees({ begin: begin.toString(), end: now.toString(), limit: 200 });
    return Array.isArray(response.data) ? response.data : [];
  }

  async verifyUserByUid(uid: string): Promise<boolean> {
    logger.debug('BLOFIN_SERVICE', `🔍 BLOFIN VERIFICATION START INITIATED | uid=${uid}`);
    
    try {
      // Primeiro: busca direta por UID
      console.log(`🎯 BLOFIN DIRECT SEARCH | uid=${uid} | method=direct`);
      const response = await this.getDirectInvitees({ uid, limit: 1 });
      console.log(`📊 BLOFIN DIRECT RESPONSE | uid=${uid} | code=${response.code} | success=${isSuccessCode(response.code)} | hasData=${Array.isArray(response.data)} | length=${response.data?.length}`);
      
      if (isSuccessCode(response.code) && Array.isArray(response.data) && response.data.length > 0) {
        console.log(`✅ BLOFIN VERIFICATION SUCCESS | uid=${uid} | method=direct | found=${response.data[0]?.uid}`);
        return true;
      }
      
      // Segundo: busca geral com diferentes limites
      const limits = [200, 100, 50];
      for (const limit of limits) {
        console.log(`🔍 BLOFIN GENERAL SEARCH | uid=${uid} | limit=${limit}`);
        const generalResponse = await this.getDirectInvitees({ limit });
        console.log(`📊 BLOFIN GENERAL RESPONSE | uid=${uid} | limit=${limit} | code=${generalResponse.code} | dataLength=${generalResponse.data?.length}`);
        
        if (Array.isArray(generalResponse.data)) {
          const foundUser = generalResponse.data.find((u) => u.uid === uid);
          if (foundUser) {
            console.log(`✅ BLOFIN VERIFICATION SUCCESS | uid=${uid} | method=general | limit=${limit} | foundUser=${JSON.stringify(foundUser)}`);
            return true;
          }
          
          // Log alguns UIDs para debug
          const sampleUids = generalResponse.data.slice(0, 5).map(u => u.uid);
          const fullUserData = generalResponse.data.slice(0, 2).map(u => ({uid: u.uid, email: u.email || 'N/A', regTime: u.regTime || 'N/A'}));
          console.log(`📋 BLOFIN SAMPLE UIDS | limit=${limit} | sampleUids=[${sampleUids.join(', ')}] | total=${generalResponse.data.length}`);
          console.log(`👥 BLOFIN USER DETAILS | limit=${limit} | users=${JSON.stringify(fullUserData)}`);
        }
      }
      
      console.log(`❌ BLOFIN VERIFICATION FAILED | uid=${uid} | searched all limits, not found`);
      return false;
      
    } catch (error) {
      console.error(`❌ BLOFIN VERIFICATION ERROR | uid=${uid} | error:`, error);
      logger.error('BLOFIN_SERVICE', `❌ BLOFIN VERIFICATION ERROR | uid=${uid}`, error as Error);
      return false;
    }
  }

  async getReferralCodeInfo(): Promise<BlofinApiResponse> {
    const response = await this.client.get('/api/v1/affiliate/referral-code');
    return response.data;
  }
}

export const blofinService = new BlofinService();