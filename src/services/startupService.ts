import { Telegraf } from 'telegraf';
import { database } from '../config/database';
import { redis } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import axios from 'axios';

export class StartupService {
  private bot: Telegraf;

  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  /**
   * Executa todas as verificações e configurações de inicialização
   */
  async initialize(): Promise<boolean> {
    logger.info('STARTUP', 'Iniciando verificações de sistema...');
    
    try {
      // 1. Verificar variáveis de ambiente obrigatórias
      await this.validateEnvironmentVariables();
      
      // 2. Configurar webhook do Telegram
      await this.setupTelegramWebhook();
      
      // 3. Verificar e inicializar banco de dados
      await this.initializeDatabase();
      
      // 4. Verificar conexão Redis
      await this.validateRedisConnection();
      
      // 5. Validar API da Blofin
      await this.validateBlofinAPI();
      
      logger.info('STARTUP', '✅ Todas as verificações de inicialização foram bem-sucedidas!');
      return true;
      
    } catch (error) {
      logger.error('STARTUP', 'Falha na inicialização do sistema', error as Error);
      return false;
    }
  }

  /**
   * Verifica se todas as variáveis de ambiente necessárias estão definidas
   */
  private async validateEnvironmentVariables(): Promise<void> {
    logger.info('STARTUP', 'Verificando variáveis de ambiente...');
    
    const requiredVars = [
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
      'JWT_SECRET',
      'ENCRYPTION_KEY'
    ];

    const missingVars: string[] = [];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }

    if (missingVars.length > 0) {
      throw new Error(`Variáveis de ambiente obrigatórias não encontradas: ${missingVars.join(', ')}`);
    }

    // Validações específicas
    if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length !== 32) {
      throw new Error('ENCRYPTION_KEY deve ter exatamente 32 caracteres');
    }

    logger.info('STARTUP', '✅ Variáveis de ambiente validadas com sucesso');
  }

  /**
   * Configura o webhook do Telegram automaticamente
   */
  private async setupTelegramWebhook(): Promise<void> {
    logger.info('STARTUP', 'Configurando webhook do Telegram...');
    
    try {
      // Verificar webhook atual
      const webhookInfo = await this.bot.telegram.getWebhookInfo();
      const expectedUrl = config.telegram.webhookUrl;
      
      if (webhookInfo.url === expectedUrl) {
        logger.info('STARTUP', `✅ Webhook já configurado corretamente: ${expectedUrl}`);
        return;
      }

      // Configurar novo webhook
      logger.info('STARTUP', `Configurando webhook para: ${expectedUrl}`);
      
      await this.bot.telegram.setWebhook(expectedUrl, {
        drop_pending_updates: true,
        allowed_updates: ['message', 'callback_query', 'chat_member']
      });
      
      // Verificar se foi configurado corretamente
      const newWebhookInfo = await this.bot.telegram.getWebhookInfo();
      
      if (newWebhookInfo.url === expectedUrl) {
        logger.info('STARTUP', '✅ Webhook configurado com sucesso!');
      } else {
        throw new Error(`Falha ao configurar webhook. URL atual: ${newWebhookInfo.url}`);
      }
      
    } catch (error) {
      logger.error('STARTUP', 'Erro ao configurar webhook do Telegram', error as Error);
      throw error;
    }
  }

  /**
   * Inicializa e verifica o banco de dados
   */
  private async initializeDatabase(): Promise<void> {
    logger.info('STARTUP', 'Verificando conexão com banco de dados...');
    
    try {
      // Verificar conexão
      await database.connect();
      
      // Verificar se as tabelas existem
      await this.createTablesIfNotExists();
      
      logger.info('STARTUP', '✅ Banco de dados inicializado com sucesso');
      
    } catch (error) {
      logger.error('STARTUP', 'Erro ao inicializar banco de dados', error as Error);
      throw error;
    }
  }

  /**
   * Cria as tabelas necessárias se elas não existirem
   */
  private async createTablesIfNotExists(): Promise<void> {
    logger.info('STARTUP', 'Verificando estrutura do banco de dados...');
    
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id VARCHAR(50) UNIQUE NOT NULL,
        username VARCHAR(100),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        blofin_uid VARCHAR(100),
        referral_token VARCHAR(100) UNIQUE,
        verification_status VARCHAR(20) DEFAULT 'pending',
        verification_attempts INTEGER DEFAULT 0,
        last_verification_attempt TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createVerificationSessionsTable = `
      CREATE TABLE IF NOT EXISTS verification_sessions (
        id SERIAL PRIMARY KEY,
        session_token VARCHAR(100) UNIQUE NOT NULL,
        telegram_id VARCHAR(50) NOT NULL,
        blofin_uid VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_users_blofin_uid ON users(blofin_uid);
      CREATE INDEX IF NOT EXISTS idx_verification_sessions_token ON verification_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_verification_sessions_telegram_id ON verification_sessions(telegram_id);
    `;

    try {
      await database.query(createUsersTable);
      await database.query(createVerificationSessionsTable);
      await database.query(createIndexes);
      
      logger.info('STARTUP', '✅ Estrutura do banco de dados verificada/criada');
      
    } catch (error) {
      logger.error('STARTUP', 'Erro ao criar estrutura do banco de dados', error as Error);
      throw error;
    }
  }

  /**
   * Verifica a conexão com Redis
   */
  private async validateRedisConnection(): Promise<void> {
    logger.info('STARTUP', 'Verificando conexão com Redis...');
    
    try {
      await redis.connect();
      
      // Teste simples de write/read
      const testKey = 'startup:test';
      const testValue = Date.now().toString();
      
      await redis.set(testKey, testValue, 10); // 10 segundos TTL
      const retrievedValue = await redis.get(testKey);
      
      if (retrievedValue !== testValue) {
        throw new Error('Falha no teste de write/read do Redis');
      }
      
      // Limpar teste
      await redis.del(testKey);
      
      logger.info('STARTUP', '✅ Conexão com Redis validada com sucesso');
      
    } catch (error) {
      logger.error('STARTUP', 'Erro ao conectar com Redis', error as Error);
      throw error;
    }
  }

  /**
   * Valida a API da Blofin
   */
  private async validateBlofinAPI(): Promise<void> {
    logger.info('STARTUP', 'Validando API da Blofin...');
    
    try {
      // Teste simples para verificar se a API está acessível
      const response = await axios.get(`${config.blofin.baseUrl}/api/v1/public/time`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Telegram-Bot/1.0'
        }
      });
      
      if (response.status === 200) {
        logger.info('STARTUP', '✅ API da Blofin está acessível');
      } else {
        throw new Error(`API da Blofin retornou status: ${response.status}`);
      }
      
    } catch (error) {
      logger.error('STARTUP', 'Erro ao validar API da Blofin', error as Error);
      throw error;
    }
  }

  /**
   * Executa verificações de saúde do sistema
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: Record<string, boolean>;
    timestamp: string;
  }> {
    const checks = {
      database: false,
      redis: false,
      blofin: false,
      telegram: false
    };

    try {
      // Verificar banco de dados
      try {
        await database.query('SELECT 1');
        checks.database = true;
      } catch (error) {
        logger.warn('HEALTH', 'Database check failed', { error: (error as Error).message });
      }

      // Verificar Redis
      try {
        await redis.ping();
        checks.redis = true;
      } catch (error) {
        logger.warn('HEALTH', 'Redis check failed', { error: (error as Error).message });
      }

      // Verificar Blofin
      try {
        const response = await axios.get(`${config.blofin.baseUrl}/api/v1/public/time`, { timeout: 5000 });
        checks.blofin = response.status === 200;
      } catch (error) {
        logger.warn('HEALTH', 'Blofin check failed', { error: (error as Error).message });
      }

      // Verificar Telegram
      try {
        await this.bot.telegram.getMe();
        checks.telegram = true;
      } catch (error) {
        logger.warn('HEALTH', 'Telegram check failed', { error: (error as Error).message });
      }

    } catch (error) {
      logger.error('HEALTH', 'Health check error', error as Error);
    }

    const allHealthy = Object.values(checks).every(check => check);
    
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString()
    };
  }
}