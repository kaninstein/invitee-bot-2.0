import express from 'express';
import { Telegraf } from 'telegraf';
import { config } from './src/config';

console.log('🚀 Starting simple bot test...');

async function startSimpleBot() {
  try {
    // Initialize Express app
    const app = express();
    app.use(express.json());
    console.log('✅ Express app initialized');
    
    // Initialize bot
    console.log('🤖 Creating Telegraf bot...');
    const bot = new Telegraf(config.telegram.botToken);
    console.log('✅ Telegraf bot created');
    
    // Simple command handler
    bot.start((ctx) => {
      ctx.reply('Hello! Bot is working! 🎉');
    });
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    
    // Webhook endpoint
    app.use('/webhook', bot.webhookCallback('/webhook'));
    
    // Start server
    const PORT = config.app.port;
    const HOST = '0.0.0.0';
    
    app.listen(PORT, HOST, () => {
      console.log(`🌐 ✅ SERVER RUNNING ON ${HOST}:${PORT}`);
      console.log(`💡 Try: curl http://localhost:${PORT}/health`);
    });
    
    // Start polling for local testing
    if (config.app.nodeEnv === 'development') {
      console.log('🔄 Starting polling mode...');
      await bot.launch();
      console.log('✅ Bot started in polling mode');
    }
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
  }
}

startSimpleBot();