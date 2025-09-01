require('dotenv').config();
console.log('Starting minimal debug...');

// Test environment variables
console.log('Environment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
console.log('- REDIS_URL:', process.env.REDIS_URL ? '✅ Set' : '❌ Missing');

// Test Telegraf
console.log('\nTesting Telegraf...');
const { Telegraf } = require('telegraf');

try {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  console.log('✅ Telegraf bot created');
  
  // Test getMe
  bot.telegram.getMe().then(info => {
    console.log('✅ Telegram getMe successful:', info.username);
    process.exit(0);
  }).catch(error => {
    console.error('❌ Telegram getMe failed:', error.message);
    process.exit(1);
  });
  
} catch (error) {
  console.error('❌ Failed to create Telegraf bot:', error.message);
  process.exit(1);
}