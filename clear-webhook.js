require('dotenv').config();
const { Telegraf } = require('telegraf');

async function clearWebhook() {
  console.log('Clearing webhook...');
  
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  
  try {
    // Delete webhook
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('✅ Webhook cleared successfully');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check webhook info
    const info = await bot.telegram.getWebhookInfo();
    console.log('Current webhook info:', info);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing webhook:', error);
    process.exit(1);
  }
}

clearWebhook();