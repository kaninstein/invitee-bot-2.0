import { Context } from 'telegraf';
import { userService } from '../../services/userService';
import { blofinService } from '../../services/blofinService';
import { redis } from '../../config/redis';
import { config } from '../../config';

// Estado da sessão para aguardar UID do usuário
const pendingUidInput = new Map<number, { userId: number; step: 'waiting_uid' }>();

export async function registerCommand(ctx: Context) {
  try {
    const telegramUser = ctx.from;
    if (!telegramUser) {
      await ctx.reply('❌ Erro ao obter informações do usuário.');
      return;
    }

    // Rate limiting - máximo 3 tentativas por hora
    const rateLimitKey = `register_attempts:${telegramUser.id}`;
    const canProceed = await redis.setRateLimit(rateLimitKey, 3, 3600);
    
    if (!canProceed) {
      await ctx.reply(
        '⏳ **Limite de tentativas atingido**\n\n' +
        'Você pode tentar verificar seu cadastro novamente em 1 hora.\n\n' +
        'Se você já se cadastrou na Blofin e ainda não conseguiu verificar, ' +
        'entre em contato com o suporte.'
      );
      return;
    }

    const user = await userService.getUserByTelegramId(telegramUser.id.toString());
    if (!user) {
      await ctx.reply(
        '❌ Usuário não encontrado. Use /start para se registrar primeiro.'
      );
      return;
    }

    if (user.group_access) {
      await ctx.reply(
        '✅ **Você já tem acesso ao grupo!**\n\n' +
        '🎉 Seu cadastro na Blofin já foi verificado e você tem acesso ao grupo de calls cripto.\n\n' +
        '💡 Use /status para ver detalhes do seu status.'
      );
      return;
    }

    // Verificar se já atingiu o limite de tentativas
    if (user.verification_attempts >= 3) {
      await ctx.reply(
        '❌ **Limite de tentativas de verificação atingido**\n\n' +
        'Você já tentou verificar seu cadastro 3 vezes sem sucesso.\n\n' +
        '📞 Entre em contato com o suporte para verificação manual.\n' +
        `🎯 Seu token: \`${user.referral_token}\``
      );
      return;
    }

    // Novo fluxo - pedir UID do usuário
    await ctx.reply(
      '🏦 **Verificação do seu cadastro na Blofin**\n\n' +
      '📋 **Passo 1:** Se você ainda não se cadastrou na Blofin, use este link:\n' +
      `🔗 ${blofinService.generateReferralLink(telegramUser.id.toString())}\n\n` +
      '📋 **Passo 2:** Após se cadastrar, me envie seu **UID da Blofin**.\n\n' +
      '💡 **Como encontrar seu UID:**\n' +
      '• Acesse sua conta na Blofin\n' +
      '• Vá em "Perfil" ou "Configurações"\n' +
      '• Seu UID será um número como: 23062566953\n\n' +
      '📝 **Agora me envie apenas seu UID:**'
    );

    // Armazenar estado de espera do UID
    pendingUidInput.set(telegramUser.id, {
      userId: user.id,
      step: 'waiting_uid'
    });

    // Limpar estado após 5 minutos
    setTimeout(() => {
      pendingUidInput.delete(telegramUser.id);
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('Error in register command:', error);
    await ctx.reply(
      '❌ **Erro durante a verificação**\n\n' +
      'Ocorreu um erro ao processar sua solicitação. Tente novamente em alguns instantes.\n\n' +
      'Se o problema persistir, entre em contato com o suporte.'
    );
  }
}

// Nova função para processar UID enviado pelo usuário
export async function handleUidInput(ctx: Context) {
  try {
    const telegramUser = ctx.from;
    if (!telegramUser) return;

    const message = ctx.message;
    if (!message || !('text' in message)) return;

    const pendingState = pendingUidInput.get(telegramUser.id);
    if (!pendingState || pendingState.step !== 'waiting_uid') {
      return; // Não está aguardando UID
    }

    const uidInput = message.text.trim();
    
    // Validar formato do UID (apenas números, entre 8-15 dígitos)
    if (!/^\d{8,15}$/.test(uidInput)) {
      await ctx.reply(
        '❌ **UID inválido**\n\n' +
        '🔢 O UID deve conter apenas números e ter entre 8-15 dígitos.\n\n' +
        '💡 **Exemplo:** 23062566953\n\n' +
        '📝 Tente novamente enviando apenas o UID:'
      );
      return;
    }

    await ctx.reply('🔍 **Verificando seu UID na Blofin...**\n\nPor favor, aguarde...');

    // Limpar estado de espera
    pendingUidInput.delete(telegramUser.id);

    // Incrementar tentativas de verificação
    await userService.incrementVerificationAttempts(pendingState.userId);

    // Verificar UID na API da Blofin
    const isValidAffiliate = await blofinService.verifyUserByUid(uidInput);

    if (isValidAffiliate) {
      // Marcar como verificado e dar acesso
      await userService.markUserAsVerified(pendingState.userId);
      
      await ctx.reply(
        '🎉 **Verificação concluída com sucesso!**\n\n' +
        '✅ Seu UID foi encontrado nos nossos afiliados!\n' +
        '🚀 Você agora tem acesso ao grupo de calls cripto!\n\n' +
        `🔗 **Link do grupo:** https://t.me/c/${config.telegram.groupId.replace('-100', '')}/1\n\n` +
        '💡 Bem-vindo ao grupo! Aproveite as calls exclusivas.'
      );

      // Log da verificação bem-sucedida
      console.log(`✅ User verified successfully: ${telegramUser.id} with UID: ${uidInput}`);
      
    } else {
      const user = await userService.getUserById(pendingState.userId);
      const remainingAttempts = user ? 3 - user.verification_attempts : 0;
      
      await ctx.reply(
        '❌ **UID não encontrado**\n\n' +
        '🔍 Não conseguimos encontrar este UID nos nossos afiliados.\n\n' +
        '**Possíveis causas:**\n' +
        '• Você não se cadastrou usando nosso link de afiliado\n' +
        '• O UID está incorreto\n' +
        '• O cadastro é muito recente (aguarde alguns minutos)\n\n' +
        `🔗 **Certifique-se de usar este link:**\n${blofinService.generateReferralLink(telegramUser.id.toString())}\n\n` +
        `⚠️ Tentativas restantes: ${remainingAttempts}\n\n` +
        '💡 Use /register novamente para tentar com outro UID.'
      );
    }

  } catch (error) {
    console.error('Error in handleUidInput:', error);
    await ctx.reply(
      '❌ **Erro durante a verificação**\n\n' +
      'Ocorreu um erro ao verificar seu UID. Tente novamente em alguns instantes.\n\n' +
      'Se o problema persistir, entre em contato com o suporte.'
    );
  }
}

// Exportar estado para uso no bot principal
export { pendingUidInput };