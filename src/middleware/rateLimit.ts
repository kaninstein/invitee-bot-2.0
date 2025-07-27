import { Context, MiddlewareFn } from 'telegraf';
import { redis } from '../config/redis';
import { config } from '../config';

export function rateLimitMiddleware(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    try {
      const telegramUser = ctx.from;
      
      if (!telegramUser) {
        return await next();
      }

      const userId = telegramUser.id.toString();
      const windowMs = config.rateLimit.windowMs;
      const maxRequests = config.rateLimit.maxRequests;
      
      // Chave para rate limiting geral
      const rateLimitKey = `rate_limit:general:${userId}`;
      
      // Verificar rate limit
      const canProceed = await redis.setRateLimit(
        rateLimitKey, 
        maxRequests, 
        Math.floor(windowMs / 1000)
      );

      if (!canProceed) {
        const timeLeft = Math.ceil(windowMs / 1000 / 60); // em minutos
        
        await ctx.reply(
          `⏳ **Limite de requisições atingido**\n\n` +
          `Você está fazendo muitas requisições. Tente novamente em ${timeLeft} minutos.\n\n` +
          `💡 Este limite existe para proteger o sistema e garantir boa performance para todos.`
        );
        return;
      }

      // Rate limit específico para comandos sensíveis
      const message = ctx.message;
      if (message && 'text' in message) {
        const command = message.text.split(' ')[0].toLowerCase();
        
        // Comandos que precisam de rate limit mais restritivo
        const sensitiveCommands = ['/register', '/start'];
        
        if (sensitiveCommands.includes(command)) {
          const commandKey = `rate_limit:${command.replace('/', '')}:${userId}`;
          const commandLimit = command === '/register' ? 5 : 10; // /register: 5/hora, /start: 10/hora
          
          const canExecuteCommand = await redis.setRateLimit(
            commandKey,
            commandLimit,
            3600 // 1 hora
          );

          if (!canExecuteCommand) {
            await ctx.reply(
              `⏳ **Limite do comando ${command} atingido**\n\n` +
              `Você pode usar este comando novamente em 1 hora.\n\n` +
              `💡 Se você está tendo problemas, use /help para obter ajuda.`
            );
            return;
          }
        }
      }

      // Logs para monitoramento
      console.log(`📊 Request from user ${userId} (${telegramUser.username}) - Rate limit OK`);

      await next();
      
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // Em caso de erro, permitir continuar para não bloquear o usuário
      await next();
    }
  };
}