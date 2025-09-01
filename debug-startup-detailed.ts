import { config, validateConfig } from './src/config';

console.log('🚀 Starting detailed startup debug...');

async function debugStartup() {
  try {
    console.log('1️⃣ Loading environment...');
    
    console.log('2️⃣ Validating configuration...');
    validateConfig();
    console.log('✅ Configuration validated');
    
    console.log('3️⃣ Testing database connection...');
    const { database } = await import('./src/config/database');
    await database.query('SELECT 1');
    console.log('✅ Database connection OK');
    
    console.log('4️⃣ Testing Redis connection...');
    const { redis } = await import('./src/config/redis');
    await redis.connect();
    await redis.ping();
    console.log('✅ Redis connection OK');
    
    console.log('5️⃣ Testing Telegram connection...');
    const { Telegraf } = await import('telegraf');
    const bot = new Telegraf(config.telegram.botToken);
    const botInfo = await bot.telegram.getMe();
    console.log('✅ Telegram connection OK:', botInfo.username);
    
    console.log('🎉 All systems are working!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

debugStartup();