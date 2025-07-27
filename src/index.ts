import express from 'express';
import { Telegraf } from 'telegraf';
import { setupBot } from './bot/bot';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { config, validateConfig } from './config';
import { setupScheduledTasks } from './utils/scheduler';
import healthRoutes from './routes/health';

async function startServer() {
  try {
    console.log('🚀 Starting Telegram Crypto Bot...');
    
    // Validate configuration
    validateConfig();
    
    // Initialize Express app
    const app = express();
    app.use(express.json());
    
    // Initialize bot
    const bot = new Telegraf(config.telegram.botToken);
    
    // Connect to services
    console.log('🔌 Connecting to services...');
    await connectDatabase();
    await connectRedis();
    
    // Setup bot
    console.log('🤖 Setting up bot...');
    setupBot(bot);
    
    // Setup routes
    app.use('/', healthRoutes);
    
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
      });
    });

    // Basic metrics endpoint
    app.get('/metrics', async (req, res) => {
      try {
        const { userService } = await import('./services/userService');
        const stats = await userService.getUserStats();
        
        res.json({
          uptime: process.uptime(),
          memory_usage: process.memoryUsage(),
          timestamp: new Date().toISOString(),
          user_stats: stats,
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get metrics',
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

    // Start server
    const PORT = config.app.port;
    const server = app.listen(PORT, () => {
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📡 Webhook URL: ${config.telegram.webhookUrl || 'Not configured'}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
    });

    // Setup scheduled tasks
    setupScheduledTasks();

    // Configure webhook or polling based on environment
    if (config.app.nodeEnv === 'production' && config.telegram.webhookUrl) {
      console.log('🔗 Setting up webhook...');
      await bot.telegram.setWebhook(config.telegram.webhookUrl);
      console.log('✅ Webhook configured successfully');
    } else {
      console.log('🔄 Starting in polling mode...');
      await bot.launch();
      console.log('✅ Bot started in polling mode');
    }

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📴 Received ${signal}, shutting down gracefully...`);
      
      try {
        // Stop bot
        bot.stop(signal);
        console.log('✅ Bot stopped');
        
        // Close server
        server.close(() => {
          console.log('✅ HTTP server closed');
        });
        
        // Close database connection
        const { database } = await import('./config/database');
        await database.close();
        console.log('✅ Database connection closed');
        
        // Close Redis connection
        const { redis } = await import('./config/redis');
        await redis.disconnect();
        console.log('✅ Redis connection closed');
        
        console.log('👋 Shutdown completed successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    console.log('🎉 Bot started successfully!');
    console.log('💡 Use /start to interact with the bot');

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();