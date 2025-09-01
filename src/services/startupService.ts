import { Telegraf } from 'telegraf';
import { database } from '../config/database';
import { redis } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { migrationRunner } from '../database/migrationRunner';
import { GroupSecurityService } from './groupSecurityService';
import axios from 'axios';

export class StartupService {
  private bot: Telegraf;
  private groupSecurity: GroupSecurityService;

  constructor(bot: Telegraf) {
    this.bot = bot;
    this.groupSecurity = new GroupSecurityService(bot);
  }

  /**
   * Executa todas as verificações e configurações de inicialização
   */
  async initialize(mode: 'webhook' | 'polling' = 'webhook'): Promise<boolean> {
    logger.info('STARTUP', 'Iniciando verificações de sistema...');
    
    try {
      // 1. Verificar variáveis de ambiente obrigatórias
      logger.info('STARTUP', '1️⃣ Validating environment variables...');
      await this.validateEnvironmentVariables();
      
      // 2. Configurar webhook do Telegram (apenas se não for polling mode)
      if (mode === 'webhook') {
        logger.info('STARTUP', '2️⃣ Setting up Telegram webhook...');
        await this.setupTelegramWebhook();
      } else {
        logger.info('STARTUP', '2️⃣ Skipping webhook setup (polling mode)');
      }
      
      // 3. Verificar e inicializar banco de dados
      logger.info('STARTUP', '3️⃣ Initializing database...');
      await this.initializeDatabase();
      
      // 4. Executar migrations do banco de dados
      logger.info('STARTUP', '4️⃣ Running database migrations...');
      await this.runDatabaseMigrations();
      
      // 5. Verificar conexão Redis
      logger.info('STARTUP', '5️⃣ Validating Redis connection...');
      try {
        await this.validateRedisConnection();
      } catch (error) {
        logger.warn('STARTUP', '⚠️ Redis connection failed, continuing without Redis:', { error: (error as Error).message });
      }
      
      // 6. Validar API da Blofin
      logger.info('STARTUP', '6️⃣ Validating Blofin API...');
      await this.validateBlofinAPI();
      
      // 7. Configurar segurança do grupo Telegram
      logger.info('STARTUP', '7️⃣ Setting up group security...');
      await this.setupGroupSecurity();
      
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
      logger.info('STARTUP', '🚀 Getting current webhook info...');
      // Verificar webhook atual
      const webhookInfo = await this.bot.telegram.getWebhookInfo();
      logger.info('STARTUP', `Current webhook: ${webhookInfo.url || 'none'}`);
      
      const expectedUrl = config.telegram.webhookUrl;
      
      if (!expectedUrl) {
        throw new Error('TELEGRAM_WEBHOOK_URL não está configurado');
      }
      
      if (webhookInfo.url === expectedUrl) {
        logger.info('STARTUP', `✅ Webhook já configurado corretamente: ${expectedUrl}`);
        return;
      }

      // Configurar novo webhook
      logger.info('STARTUP', `🔧 Configurando webhook para: ${expectedUrl}`);
      
      await this.bot.telegram.setWebhook(expectedUrl, {
        drop_pending_updates: true,
        allowed_updates: ['message', 'callback_query', 'chat_member']
      });
      
      logger.info('STARTUP', '🔍 Verificando webhook configurado...');
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
      // Testar conexão com uma query simples
      await database.query('SELECT 1');
      
      logger.info('STARTUP', '✅ Conexão com banco de dados estabelecida');
      
    } catch (error) {
      logger.error('STARTUP', 'Erro ao conectar com banco de dados', error as Error);
      throw error;
    }
  }

  /**
   * Executa migrations do banco de dados
   */
  private async runDatabaseMigrations(): Promise<void> {
    logger.info('STARTUP', 'Verificando migrations do banco de dados...');
    
    try {
      // Verificar se há migrations pendentes
      const hasPending = await migrationRunner.hasPendingMigrations();
      
      if (hasPending) {
        logger.info('STARTUP', 'Executando migrations pendentes...');
        await migrationRunner.runPendingMigrations();
      } else {
        logger.info('STARTUP', '✅ Todas as migrations já foram executadas');
      }

      // Mostrar status das migrations
      const status = await migrationRunner.getMigrationStatus();
      logger.info('STARTUP', `Status: ${status.executed.length} executadas, ${status.pending.length} pendentes`);
      
    } catch (error) {
      logger.error('STARTUP', 'Erro ao executar migrations', error as Error);
      throw error;
    }
  }

  /**
   * Verifica a conexão com Redis
   */
  private async validateRedisConnection(): Promise<void> {
    logger.info('STARTUP', 'Verificando conexão com Redis...');
    
    try {
      // Connect if not already connected
      await redis.connect();
      
      // Test ping first
      await redis.ping();
      
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
   * Configura segurança do grupo Telegram
   */
  private async setupGroupSecurity(): Promise<void> {
    logger.info('STARTUP', 'Configurando segurança do grupo Telegram...');
    
    try {
      const success = await this.groupSecurity.setupGroupSecurity();
      
      if (success) {
        logger.info('STARTUP', '✅ Segurança do grupo configurada com sucesso');
      } else {
        logger.warn('STARTUP', '⚠️ Falha na configuração de segurança do grupo - continuando inicialização');
      }
      
    } catch (error) {
      logger.error('STARTUP', 'Erro ao configurar segurança do grupo', error as Error);
      // Não interromper a inicialização por causa da segurança do grupo
      logger.warn('STARTUP', 'Continuando inicialização sem configuração completa de segurança');
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