import { Context, MiddlewareFn } from 'telegraf';

export function errorHandler(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      console.error('❌ Bot error:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        user_id: ctx.from?.id,
        username: ctx.from?.username,
        chat_id: ctx.chat?.id,
        update_type: ctx.updateType,
        timestamp: new Date().toISOString(),
      });

      // Determinar mensagem de erro apropriada baseada no tipo de erro
      let errorMessage = '❌ Ocorreu um erro inesperado. Tente novamente em alguns instantes.';

      if (error instanceof Error) {
        // Erros específicos que podemos tratar de forma mais amigável
        if (error.message.includes('network') || error.message.includes('timeout')) {
          errorMessage = '🌐 Erro de conexão. Verifique sua internet e tente novamente.';
        } else if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          errorMessage = '⏳ Muitas requisições. Aguarde alguns minutos e tente novamente.';
        } else if (error.message.includes('forbidden') || error.message.includes('blocked')) {
          errorMessage = '🚫 Não foi possível enviar a mensagem. Verifique se o bot não foi bloqueado.';
        } else if (error.message.includes('database') || error.message.includes('connection')) {
          errorMessage = '💾 Erro temporário no sistema. Tente novamente em alguns instantes.';
        }
      }

      // Tentar enviar mensagem de erro para o usuário
      try {
        await ctx.reply(errorMessage + '\n\n💡 Se o problema persistir, use /help para obter suporte.');
      } catch (replyError) {
        console.error('❌ Failed to send error message to user:', replyError);
      }

      // Para ambiente de desenvolvimento, incluir mais detalhes
      if (process.env.NODE_ENV === 'development') {
        try {
          await ctx.reply(`🐛 Dev Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } catch (devError) {
          console.error('❌ Failed to send dev error message:', devError);
        }
      }
    }
  };
}