import express from 'express';
import { Telegraf } from 'telegraf';
import { setupBot } from './src/bot/bot';
import { config } from './src/config';

console.log('🚀 Starting working bot...');

async function startWorkingBot() {
  try {
    // Initialize Express app
    const app = express();
    app.use(express.json());
    console.log('✅ Express app initialized');
    
    // Initialize bot
    console.log('🤖 Creating Telegraf bot...');
    const bot = new Telegraf(config.telegram.botToken);
    console.log('✅ Telegraf bot created');
    
    // Setup bot with full functionality
    console.log('🔧 Setting up bot handlers...');
    setupBot(bot);
    console.log('✅ Bot handlers set up');
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    
    // Webhook endpoint
    app.use('/webhook', bot.webhookCallback('/webhook'));
    
    // Basic routes
    app.get('/', (req, res) => {
      res.json({
        name: 'Telegram Crypto Bot',
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    });
    
    // Start server
    const PORT = config.app.port;
    const HOST = '0.0.0.0';
    
    app.listen(PORT, HOST, () => {
      console.log(`🌐 ✅ SERVER RUNNING ON ${HOST}:${PORT}`);
      console.log(`💡 Health check: http://localhost:${PORT}/health`);
    });
    
    // Start polling for local testing
    if (config.app.nodeEnv === 'development') {
      console.log('🔄 Starting polling mode...');
      try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('✅ Webhook cleared');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await bot.launch();
        console.log('✅ Bot started in polling mode');
      } catch (error) {
        console.error('❌ Polling failed:', error);
      }
    }
    
    console.log('🎉 Bot is ready! Try /start command in Telegram');
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
  }
}

startWorkingBot();