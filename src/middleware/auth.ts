import { Context, MiddlewareFn } from 'telegraf';
import { redis } from '../config/redis';
import { userService } from '../services/userService';

export function authMiddleware(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    try {
      const telegramUser = ctx.from;
      
      if (!telegramUser) {
        await ctx.reply('❌ Não foi possível identificar o usuário.');
        return;
      }

      // Verificar se o usuário está banido (implementação futura)
      const isBanned = await redis.get(`banned_user:${telegramUser.id}`);
      if (isBanned) {
        await ctx.reply('🚫 Você foi banido de usar este bot.');
        return;
      }

      // Buscar ou criar usuário no contexto
      let user = await userService.getUserByTelegramId(telegramUser.id.toString());
      
      // Se o usuário não existe, não é necessário criar aqui (será criado no /start)
      // Apenas adicionar ao contexto se existir
      if (user) {
        (ctx as any).user = user;
      }

      // Salvar informações da sessão no Redis
      await redis.cacheUserSession(telegramUser.id.toString(), {
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        last_activity: new Date().toISOString(),
      }, 3600); // 1 hora

      await next();
      
    } catch (error) {
      console.error('Auth middleware error:', error);
      await ctx.reply('❌ Erro de autenticação. Tente novamente.');
    }
  };
}