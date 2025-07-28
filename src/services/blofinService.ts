import axios, { AxiosInstance, AxiosResponse } from 'axios';
import CryptoJS from 'crypto-js';
import { config } from '../config';
import { BlofinApiResponse, BlofinInvitee } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

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

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor para adicionar headers de autenticação
    this.client.interceptors.request.use((config) => {
      const requestId = uuidv4();
      const timestamp = Date.now().toString();
      const nonce = uuidv4(); // Usar UUID como nonce
      const method = config.method?.toUpperCase() || 'GET';
      
      // Build complete request path including query parameters
      let requestPath = config.url || '';
      if (config.params && Object.keys(config.params).length > 0) {
        const queryString = new URLSearchParams(config.params).toString();
        requestPath += '?' + queryString;
      }
      
      const body = config.data ? JSON.stringify(config.data) : '';
      
      logger.blofinRequest(requestPath, requestId, {
        method,
        hasBody: !!body,
        bodyLength: body.length
      });
      
      // Formato correto da documentação: requestPath + method + timestamp + nonce + body
      const prehash = requestPath + method + timestamp + nonce + body;
      
      logger.debug('BLOFIN_AUTH', `Generating signature for ${method} ${requestPath}`, {
        requestId,
        timestamp,
        nonce,
        prehashLength: prehash.length,
        hasApiKey: !!this.apiKey,
        hasSecretKey: !!this.secretKey,
        hasPassphrase: !!this.passphrase
      });
      
      // Generate HMAC-SHA256 signature and convert to base64 (matching Postman exactly)
      const hexSignature = CryptoJS.HmacSHA256(prehash, this.secretKey).toString();
      const signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(hexSignature));

      // Headers conforme documentação da Blofin
      config.headers = {
        ...config.headers,
        'ACCESS-KEY': this.apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-NONCE': nonce,
        'ACCESS-PASSPHRASE': this.passphrase,
        'X-REQUEST-ID': requestId,
      } as any;

      logger.trace('BLOFIN_AUTH', `Request headers generated`, {
        requestId,
        headers: {
          'ACCESS-KEY': this.apiKey.substring(0, 8) + '...',
          'ACCESS-TIMESTAMP': timestamp,
          'ACCESS-NONCE': nonce.substring(0, 8) + '...',
          'ACCESS-PASSPHRASE': '***',
          'ACCESS-SIGN': signature.substring(0, 16) + '...'
        }
      });

      return config;
    });

    // Response interceptor para tratamento de erros
    this.client.interceptors.response.use(
      (response) => {
        const requestId = response.config.headers?.['X-REQUEST-ID'];
        const duration = Date.now() - parseInt(response.config.headers?.['ACCESS-TIMESTAMP'] || '0');
        
        logger.blofinResponse(
          response.config.url || '',
          response.status >= 200 && response.status < 300,
          response.data?.code,
          duration,
          requestId
        );
        
        // Log response details for debugging
        logger.trace('BLOFIN_RESPONSE', `Response received`, {
          requestId,
          status: response.status,
          statusText: response.statusText,
          code: response.data?.code,
          message: response.data?.msg,
          hasData: !!response.data?.data,
          duration
        });
        
        return response;
      },
      (error) => {
        const requestId = error.config?.headers?.['X-REQUEST-ID'];
        const duration = Date.now() - parseInt(error.config?.headers?.['ACCESS-TIMESTAMP'] || '0');
        
        logger.blofinError(
          error.config?.url || 'unknown',
          error,
          requestId,
          {
            status: error.response?.status,
            statusText: error.response?.statusText,
            responseData: error.response?.data,
            duration
          }
        );
        
        // Log detailed error information
        logger.error('BLOFIN_API_ERROR', 'Blofin API request failed', error, {
          requestId,
          request: {
            method: error.config?.method,
            url: error.config?.url,
            headers: {
              'ACCESS-KEY': error.config?.headers?.['ACCESS-KEY']?.substring(0, 8) + '...',
              'ACCESS-TIMESTAMP': error.config?.headers?.['ACCESS-TIMESTAMP']
            }
          },
          response: {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers
          },
          duration
        });
        
        throw error;
      }
    );
  }

  /**
   * Obter informações básicas do afiliado
   */
  async getAffiliateBasicInfo(): Promise<BlofinApiResponse> {
    const startTime = Date.now();
    try {
      logger.info('BLOFIN_API', 'Fetching affiliate basic info');
      const response: AxiosResponse<BlofinApiResponse> = await this.client.get('/api/v1/affiliate/basic');
      
      const duration = Date.now() - startTime;
      logger.performance('getAffiliateBasicInfo', duration, {
        responseCode: response.data.code,
        hasData: !!response.data.data
      });
      
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('BLOFIN_API', 'Failed to get affiliate basic info', error as Error, {
        duration,
        endpoint: '/api/v1/affiliate/basic'
      });
      throw error;
    }
  }

  /**
   * Obter convidados diretos do afiliado
   * @param params - Parâmetros de busca
   */
  async getDirectInvitees(params?: {
    uid?: string;
    needEquity?: string;
    after?: string;
    before?: string;
    begin?: string;
    end?: string;
    limit?: number;
  }): Promise<BlofinApiResponse> {
    try {
      const queryParams: any = {};
      
      if (params) {
        if (params.uid) queryParams.uid = params.uid;
        if (params.needEquity) queryParams.needEquity = params.needEquity;
        if (params.after) queryParams.after = params.after;
        if (params.before) queryParams.before = params.before;
        if (params.begin) queryParams.begin = params.begin;
        if (params.end) queryParams.end = params.end;
        if (params.limit) queryParams.limit = params.limit;
      }

      // Definir limite padrão se não especificado
      if (!queryParams.limit) {
        queryParams.limit = 100;
      }

      const response: AxiosResponse<BlofinApiResponse> = await this.client.get(
        '/api/v1/affiliate/invitees',
        { params: queryParams }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error getting direct invitees:', error);
      throw error;
    }
  }

  /**
   * Verificar se um usuário se cadastrou via link de afiliado
   * @param identifier - UID do usuário para verificar
   */
  async verifyUserRegistration(identifier: string): Promise<boolean> {
    const startTime = Date.now();
    const verificationId = uuidv4();
    
    try {
      logger.info('BLOFIN_VERIFICATION', `Starting user verification for UID: ${identifier}`, {
        verificationId,
        uid: identifier
      });
      
      // Primeira tentativa: buscar por UID específico
      logger.debug('BLOFIN_VERIFICATION', 'Attempting specific UID search', {
        verificationId,
        uid: identifier,
        method: 'specific_search'
      });
      
      const response = await this.getDirectInvitees({
        uid: identifier,
        limit: 1,
      });

      if (response.code === 200 && response.data && Array.isArray(response.data) && response.data.length > 0) {
        const user = response.data[0];
        logger.info('BLOFIN_VERIFICATION', `User ${identifier} found in affiliate invitees`, {
          verificationId,
          uid: identifier,
          method: 'specific_search',
          userInfo: {
            uid: user.uid,
            registerTime: user.registerTime,
            kycLevel: user.kycLevel,
            totalTradingVolume: user.totalTradingVolume
          },
          duration: Date.now() - startTime
        });
        return true;
      }

      // Segunda tentativa: buscar em lista geral
      logger.debug('BLOFIN_VERIFICATION', 'Attempting general list search', {
        verificationId,
        uid: identifier,
        method: 'general_search',
        limit: 200
      });
      
      const generalResponse = await this.getDirectInvitees({
        limit: 200,
      });

      if (generalResponse.code === 200 && generalResponse.data && Array.isArray(generalResponse.data)) {
        const userFound = generalResponse.data.find((invitee: any) => 
          invitee.uid === identifier
        );

        if (userFound) {
          logger.info('BLOFIN_VERIFICATION', `User ${identifier} found in general affiliate list`, {
            verificationId,
            uid: identifier,
            method: 'general_search',
            totalInvitees: generalResponse.data.length,
            userInfo: {
              uid: userFound.uid,
              registerTime: userFound.registerTime,
              kycLevel: userFound.kycLevel,
              totalTradingVolume: userFound.totalTradingVolume
            },
            duration: Date.now() - startTime
          });
          return true;
        }
      }

      logger.warn('BLOFIN_VERIFICATION', `User ${identifier} not found in affiliate invitees`, {
        verificationId,
        uid: identifier,
        totalChecked: (generalResponse.data?.length || 0) + 1,
        duration: Date.now() - startTime
      });
      
      return false;
    } catch (error) {
      logger.error('BLOFIN_VERIFICATION', `Failed to verify user ${identifier}`, error as Error, {
        verificationId,
        uid: identifier,
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  /**
   * Verificar se um usuário se cadastrou recentemente (últimas 48h)
   * @param identifier - UID do usuário para verificar
   */
  async verifyRecentRegistration(identifier: string): Promise<boolean> {
    try {
      const now = Date.now();
      const twoDaysAgo = now - (48 * 60 * 60 * 1000); // 48 horas atrás

      const response = await this.getDirectInvitees({
        begin: twoDaysAgo.toString(),
        end: now.toString(),
        limit: 200,
      });

      if (response.code === 200 && response.data && Array.isArray(response.data)) {
        const userFound = response.data.some((invitee: any) => 
          invitee.uid === identifier
        );

        if (userFound) {
          console.log(`✅ User ${identifier} found in recent registrations`);
          return true;
        }
      }

      console.log(`❌ User ${identifier} not found in recent registrations`);
      return false;
    } catch (error) {
      console.error('Error verifying recent registration:', error);
      return false;
    }
  }

  /**
   * Obter estatísticas do afiliado (usar informações básicas)
   */
  async getAffiliateStats(): Promise<BlofinApiResponse> {
    try {
      // Usar o endpoint de informações básicas que contém as estatísticas
      const response = await this.getAffiliateBasicInfo();
      return response;
    } catch (error) {
      console.error('Error getting affiliate stats:', error);
      throw error;
    }
  }

  /**
   * Verificar se a API está funcionando
   */
  async healthCheck(): Promise<boolean> {
    const startTime = Date.now();
    const healthCheckId = uuidv4();
    
    try {
      logger.info('BLOFIN_HEALTH', 'Starting Blofin API health check', {
        healthCheckId
      });
      
      const response = await this.getAffiliateBasicInfo();
      const duration = Date.now() - startTime;
      const isHealthy = response.code === 200;
      
      if (isHealthy) {
        logger.info('BLOFIN_HEALTH', 'Blofin API health check passed', {
          healthCheckId,
          responseCode: response.code,
          duration,
          status: 'healthy'
        });
      } else {
        logger.warn('BLOFIN_HEALTH', 'Blofin API health check failed - invalid response code', {
          healthCheckId,
          responseCode: response.code,
          responseMessage: response.msg,
          duration,
          status: 'unhealthy'
        });
      }
      
      return isHealthy;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('BLOFIN_HEALTH', 'Blofin API health check failed with error', error as Error, {
        healthCheckId,
        duration,
        status: 'error'
      });
      return false;
    }
  }

  /**
   * Gerar link de referência personalizado
   * @param telegramId - ID do usuário do Telegram para rastreamento
   */
  generateReferralLink(telegramId?: string): string {
    const referralCode = config.blofin.referralCode;
    
    // Usar o formato correto de link de registro
    let referralUrl = `https://blofin.com/register?referral_code=${referralCode}`;
    
    if (telegramId) {
      referralUrl += `&source=telegram_${telegramId}`;
    }
    
    return referralUrl;
  }

  /**
   * Buscar usuário por UID
   * @param uid - UID do usuário
   */
  async findUserByUid(uid: string): Promise<any | null> {
    try {
      const response = await this.getDirectInvitees({
        uid: uid,
        limit: 1,
      });

      if (response.code === 200 && response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0];
      }

      return null;
    } catch (error) {
      console.error('Error finding user by UID:', error);
      return null;
    }
  }

  /**
   * Buscar todos os afiliados recentes
   * @param hours - Número de horas para buscar registros recentes (padrão: 48)
   */
  async getRecentInvitees(hours: number = 48): Promise<any[]> {
    try {
      const now = Date.now();
      const hoursAgo = now - (hours * 60 * 60 * 1000);

      const response = await this.getDirectInvitees({
        begin: hoursAgo.toString(),
        end: now.toString(),
        limit: 200,
      });

      if (response.code === 200 && response.data && Array.isArray(response.data)) {
        return response.data;
      }

      return [];
    } catch (error) {
      console.error('Error getting recent invitees:', error);
      return [];
    }
  }

  /**
   * Verificar usuário por UID na lista de afiliados
   * @param uid - UID do usuário para verificar
   */
  async verifyUserByUid(uid: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking UID ${uid} in affiliate invitees...`);
      
      // Debug: Log API response details
      const response = await this.getDirectInvitees({
        uid: uid,
        limit: 1,
      });

      console.log(`📊 API Response Debug:`, {
        code: response.code,
        msg: response.msg,
        dataType: typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'not array',
        hasData: !!response.data
      });

      // Check for the correct success codes based on the documentation
      if ((response.code === 200 || response.code === 0) 
          && response.data && Array.isArray(response.data) && response.data.length > 0) {
        const user = response.data[0];
        console.log(`✅ UID ${uid} found in affiliate invitees:`, {
          uid: user.uid,
          registerTime: new Date(parseInt(user.registerTime)).toLocaleString('pt-BR'),
          kycLevel: user.kycLevel,
          totalTradingVolume: user.totalTradingVolume
        });
        return true;
      }

      // Segunda tentativa: buscar em lista geral usando diferentes limits
      console.log(`🔄 UID ${uid} not found in specific search, checking general list...`);
      const limits = [200, 100, 50]; // Try different limits in case of API restrictions
      
      for (const limit of limits) {
        try {
          const generalResponse = await this.getDirectInvitees({ limit });
          
          console.log(`📊 General API Response (limit ${limit}):`, {
            code: generalResponse.code,
            msg: generalResponse.msg,
            dataLength: Array.isArray(generalResponse.data) ? generalResponse.data.length : 'not array'
          });

          if ((generalResponse.code === 200 || generalResponse.code === 0) 
              && generalResponse.data && Array.isArray(generalResponse.data)) {
            
            console.log(`📋 Checking ${generalResponse.data.length} invitees for UID ${uid}`);
            
            const userFound = generalResponse.data.find((invitee: any) => 
              String(invitee.uid) === String(uid) // Ensure string comparison
            );

            if (userFound) {
              console.log(`✅ UID ${uid} found in general affiliate list (limit ${limit}):`, {
                uid: userFound.uid,
                registerTime: new Date(parseInt(userFound.registerTime)).toLocaleString('pt-BR'),
                kycLevel: userFound.kycLevel,
                totalTradingVolume: userFound.totalTradingVolume
              });
              return true;
            }
            
            // If we got results, no need to try other limits
            if (generalResponse.data.length > 0) {
              break;
            }
          }
        } catch (limitError) {
          console.error(`Error with limit ${limit}:`, limitError);
          continue;
        }
      }

      console.log(`❌ UID ${uid} not found in affiliate invitees`);
      return false;
    } catch (error) {
      console.error('Error verifying user by UID:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('API Error Response:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          headers: axiosError.response?.headers
        });
      }
      return false;
    }
  }

  /**
   * Obter informações do código de referência
   */
  async getReferralCodeInfo(): Promise<BlofinApiResponse> {
    try {
      const response: AxiosResponse<BlofinApiResponse> = await this.client.get('/api/v1/affiliate/referral-code');
      return response.data;
    } catch (error) {
      console.error('Error getting referral code info:', error);
      throw error;
    }
  }
}

export const blofinService = new BlofinService();