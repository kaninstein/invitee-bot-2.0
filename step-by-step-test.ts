console.log('Step 1: Basic imports');
import express from 'express';
console.log('✅ Express imported');

import { Telegraf } from 'telegraf';
console.log('✅ Telegraf imported');

console.log('Step 2: Config import');
import { config } from './src/config';
console.log('✅ Config imported');

console.log('Step 3: Testing setup bot import');
// Don't import setupBot yet, let's test if this works first

const bot = new Telegraf(config.telegram.botToken);
console.log('✅ Bot created');

// Simple /start handler
bot.start((ctx) => {
  console.log('Got /start command from', ctx.from?.first_name);
  ctx.reply('✅ Bot is working! The /start command works perfectly. 🎉');
});

bot.launch().then(() => {
  console.log('✅ Bot launched successfully and is ready to receive commands!');
}).catch(error => {
  console.error('❌ Bot launch failed:', error);
});

console.log('🎉 Script completed, bot should be running now!');