import { Context, MiddlewareFn } from 'telegraf';

export function loggingMiddleware(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const start = Date.now();
    
    try {
      const telegramUser = ctx.from;
      const message = ctx.message;
      
      let logData: any = {
        timestamp: new Date().toISOString(),
        user_id: telegramUser?.id,
        username: telegramUser?.username,
        first_name: telegramUser?.first_name,
      };

      if (message && 'text' in message) {
        logData.command = message.text.split(' ')[0];
        logData.message_length = message.text.length;
      }

      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        logData.callback_data = ctx.callbackQuery.data;
      }

      console.log('📝 TELEGRAM REQUEST:', JSON.stringify(logData, null, 2));
      
      // Log adicional para debug
      if (message && 'text' in message) {
        console.log(`🤖 COMANDO RECEBIDO: "${message.text}" de @${telegramUser?.username || telegramUser?.id}`);
      }

      await next();

      const duration = Date.now() - start;
      console.log(`✅ Request completed in ${duration}ms for user ${telegramUser?.id}`);
      
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`❌ Request failed after ${duration}ms:`, error);
      
      // Re-throw para não interferir no error handling
      throw error;
    }
  };
}