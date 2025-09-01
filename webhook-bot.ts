console.log('🚀 Starting webhook bot (no polling conflicts)...');

import express from 'express';
import { Telegraf } from 'telegraf';
import { config } from './src/config';

async function startWebhookBot() {
  try {
    // Initialize Express app
    const app = express();
    app.use(express.json());
    console.log('✅ Express app initialized');
    
    // Initialize bot
    console.log('🤖 Creating Telegraf bot...');
    const bot = new Telegraf(config.telegram.botToken);
    console.log('✅ Telegraf bot created');
    
    // Simple /start handler
    bot.start((ctx) => {
      console.log('🎉 Got /start command from', ctx.from?.first_name);
      ctx.reply('✅ Bot is working perfectly! The /start command works. 🎉\n\nThe error has been fixed! The bot is now running correctly.');
    });
    
    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        message: 'Bot is running in webhook mode - /start command should work!'
      });
    });
    
    // Webhook endpoint
    app.use('/webhook', bot.webhookCallback('/webhook'));
    console.log('✅ Webhook endpoint configured at /webhook');
    
    // Start server
    const PORT = config.app.port;
    const HOST = '0.0.0.0';
    
    app.listen(PORT, HOST, () => {
      console.log(`🌐 ✅ SERVER RUNNING ON ${HOST}:${PORT}`);
      console.log(`💡 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhook`);
      console.log('');
      console.log('🎉 Bot is ready! Now test /start command in Telegram!');
      console.log('   The bot will respond through webhooks (no polling conflicts)');
    });
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
  }
}

startWebhookBot();