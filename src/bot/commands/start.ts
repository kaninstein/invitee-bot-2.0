import { Context } from 'telegraf';
import { userService } from '../../services/userService';
import { blofinService } from '../../services/blofinService';
import { config } from '../../config';
import { redis } from '../../config/redis';

// Estado da sessão para aguardar UID do usuário no /start
const pendingUidInput = new Map<number, { userId: number; step: 'waiting_uid' }>();

export async function startCommand(ctx: Context) {
  try {
    console.log('🚀 COMANDO /start EXECUTADO!');
    
    const telegramUser = ctx.from;
    if (!telegramUser) {
      console.log('❌ Erro: telegramUser é null');
      await ctx.reply('❌ Erro ao obter informações do usuário.');
      return;
    }
    
    console.log(`👤 Usuário: @${telegramUser.username || telegramUser.id} (${telegramUser.first_name})`);

    // Criar ou atualizar usuário no banco
    const user = await userService.createOrUpdateUser({
      telegram_id: telegramUser.id.toString(),
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
    });

    const firstName = telegramUser.first_name || 'Usuário';
    
    if (user.group_access) {
      await ctx.reply(
        `🎉 Olá ${firstName}!\n\n` +
        `✅ Você já tem acesso ao grupo de calls cripto!\n\n` +
        `🔗 [Clique aqui para entrar no grupo](https://t.me/c/${config.telegram.groupId.replace('-100', '')}/1)\n\n` +
        `💡 Use /status para verificar seu status atual.`
      );
      return;
    }

    // Rate limiting para evitar spam
    const rateLimitKey = `start_attempts:${telegramUser.id}`;
    const canProceed = await redis.setRateLimit(rateLimitKey, 5, 3600);
    
    if (!canProceed) {
      await ctx.reply(
        '⏳ **Limite de tentativas atingido**\n\n' +
        'Você pode tentar novamente em 1 hora.\n\n' +
        'Se você já se cadastrou na Blofin, entre em contato com o suporte.'
      );
      return;
    }

    // Verificar se já atingiu o limite de tentativas de verificação
    if (user.verification_attempts >= 3) {
      await ctx.reply(
        '❌ **Limite de tentativas de verificação atingido**\n\n' +
        'Você já tentou verificar seu cadastro 3 vezes sem sucesso.\n\n' +
        '📞 Entre em contato com o suporte para verificação manual.\n' +
        `🎯 Seu token: \`${user.referral_token}\``
      );
      return;
    }

    const welcomeMessage = `
🚀 **Bem-vindo ao Bot de Calls Cripto!**

👋 Olá ${firstName}!

Para ter acesso ao nosso grupo exclusivo de calls cripto:

**🏦 PASSO 1: Cadastro na Blofin**
• Se cadastre usando OBRIGATORIAMENTE este link:
${blofinService.generateReferralLink(telegramUser.id.toString())}

**📺 PASSO 2: Tutorial em Vídeo**
• Assista como encontrar seu UID:
🎥 https://www.loom.com/share/seu-tutorial-uid

**🔍 PASSO 3: Envie seu UID**
• Após se cadastrar, me envie seu UID da Blofin
• É um número como: 23062566953
• Encontre em: Perfil → Configurações → UID

📝 **Agora me envie apenas seu UID da Blofin:**
    `.trim();

    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });

    // Armazenar estado de espera do UID
    pendingUidInput.set(telegramUser.id, {
      userId: user.id,
      step: 'waiting_uid'
    });

    // Limpar estado após 10 minutos
    setTimeout(() => {
      pendingUidInput.delete(telegramUser.id);
    }, 10 * 60 * 1000);

  } catch (error) {
    console.error('Error in start command:', error);
    await ctx.reply(
      '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente em alguns instantes.\n\n' +
      'Se o problema persistir, entre em contato com o suporte.'
    );
  }
}

// Nova função para processar UID enviado pelo usuário no /start
export async function handleStartUidInput(ctx: Context) {
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
      const user = await userService.getUserByTelegramId(pendingState.userId.toString());
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
        '💡 Use /start novamente para tentar com outro UID.'
      );
    }

  } catch (error) {
    console.error('Error in handleStartUidInput:', error);
    await ctx.reply(
      '❌ **Erro durante a verificação**\n\n' +
      'Ocorreu um erro ao verificar seu UID. Tente novamente em alguns instantes.\n\n' +
      'Se o problema persistir, entre em contato com o suporte.'
    );
  }
}

// Exportar estado para uso no bot principal
export { pendingUidInput };