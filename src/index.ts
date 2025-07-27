import express from 'express';
import { Telegraf } from 'telegraf';
import { setupBot } from './bot/bot';
import { config, validateConfig } from './config';
import { setupScheduledTasks } from './utils/scheduler';
import { StartupService } from './services/startupService';
import { logger } from './utils/logger';
import healthRoutes from './routes/health';

async function startServer() {
  try {
    logger.info('STARTUP', '🚀 Starting Telegram Crypto Bot...');
    
    // Validate configuration
    validateConfig();
    
    // Initialize Express app
    const app = express();
    app.use(express.json());
    
    // Initialize bot
    const bot = new Telegraf(config.telegram.botToken);
    
    // Initialize startup service and run all checks
    const startupService = new StartupService(bot);
    const initSuccess = await startupService.initialize();
    
    if (!initSuccess) {
      throw new Error('Falha na inicialização do sistema');
    }
    
    // Setup bot
    logger.info('STARTUP', '🤖 Setting up bot...');
    setupBot(bot);
    
    // Setup routes
    app.use('/', healthRoutes);
    
    // Debug endpoint para webhook
    app.use('/webhook', (req, res, next) => {
      console.log('🔗 WEBHOOK CHAMADO:', {
        method: req.method,
        headers: req.headers,
        body: req.body,
        timestamp: new Date().toISOString()
      });
      next();
    });
    
    // Setup webhook endpoint
    app.use(bot.webhookCallback('/webhook'));
    
    // Root endpoint
    app.get('/', (req, res) => {
      res.json({
        name: 'Telegram Crypto Bot',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        description: 'Bot para controle de acesso a grupo de calls cripto via afiliados Blofin',
        port: PORT,
        host: HOST,
        environment: config.app.nodeEnv,
      });
    });

    // Simple test endpoint
    app.get('/test', (req, res) => {
      console.log('🧪 TEST endpoint called');
      res.json({
        message: 'Service is running correctly!',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        port: PORT,
        host: HOST,
      });
    });

    // Basic metrics endpoint
    app.get('/metrics', async (req, res) => {
      try {
        const { userService } = await import('./services/userService');
        const stats = await userService.getUserStats();
        const healthStatus = await startupService.healthCheck();
        
        res.json({
          uptime: process.uptime(),
          memory_usage: process.memoryUsage(),
          timestamp: new Date().toISOString(),
          user_stats: stats,
          health: healthStatus,
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get metrics',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Enhanced health check endpoint
    app.get('/health/detailed', async (req, res) => {
      try {
        const healthStatus = await startupService.healthCheck();
        res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
      });
    });

    // Error handler
    app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Express error:', error);
      res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    });

    // Start server - bind to 0.0.0.0 for container accessibility
    const PORT = config.app.port;
    const HOST = '0.0.0.0';
    const server = app.listen(PORT, HOST, () => {
      console.log(`🌐 Server running on ${HOST}:${PORT}`);
      console.log(`📡 Webhook URL: ${config.telegram.webhookUrl || 'Not configured'}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
      console.log(`🔗 External webhook: https://bot-telegram-bot.kmnpkd.easypanel.host/webhook`);
    });

    // Setup scheduled tasks
    setupScheduledTasks();

    // Configure webhook or polling based on environment
    if (config.app.nodeEnv === 'production' && config.telegram.webhookUrl) {
      logger.info('STARTUP', '✅ Webhook configured automatically by startup service');
    } else {
      logger.info('STARTUP', '🔄 Starting in polling mode...');
      await bot.launch();
      logger.info('STARTUP', '✅ Bot started in polling mode');
    }

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      logger.info('SHUTDOWN', `📴 Received ${signal}, shutting down gracefully...`);
      
      try {
        // Stop bot
        bot.stop(signal);
        logger.info('SHUTDOWN', '✅ Bot stopped');
        
        // Close server
        server.close(() => {
          logger.info('SHUTDOWN', '✅ HTTP server closed');
        });
        
        // Close database connection
        const { database } = await import('./config/database');
        await database.close();
        logger.info('SHUTDOWN', '✅ Database connection closed');
        
        // Close Redis connection
        const { redis } = await import('./config/redis');
        await redis.disconnect();
        logger.info('SHUTDOWN', '✅ Redis connection closed');
        
        logger.info('SHUTDOWN', '👋 Shutdown completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('SHUTDOWN', '❌ Error during shutdown', error as Error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('SYSTEM', '💥 Uncaught Exception', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('SYSTEM', '💥 Unhandled Rejection', new Error(String(reason)), {
        promise: String(promise),
        reason: String(reason)
      });
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    logger.info('STARTUP', '🎉 Bot started successfully!');
    logger.info('STARTUP', '💡 Use /start to interact with the bot');

  } catch (error) {
    logger.error('STARTUP', '❌ Failed to start server', error as Error);
    process.exit(1);
  }
}

// Start the application
startServer();