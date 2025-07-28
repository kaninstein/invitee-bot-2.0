import { Context } from 'telegraf';
import { userService } from '../../services/userService';
import { blofinService } from '../../services/blofinService';
import { config } from '../../config';
import { redis } from '../../config/redis';
import { GroupSecurityService } from '../../services/groupSecurityService';

// Estado da sessão para aguardar UID do usuário no /start
const pendingUidInput = new Map<number, { userId: number; step: 'waiting_uid' }>();

// Instância do serviço de segurança do grupo (será inicializada quando necessário)
let groupSecurity: GroupSecurityService | null = null;

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

    // Rate limiting para evitar spam (skip in test mode)
    const isTestMode = process.env.NODE_ENV === 'development' || 
                      process.env.DISABLE_RATE_LIMIT === 'true' ||
                      process.env.TEST_MODE === 'true';
    
    if (!isTestMode) {
      const rateLimitKey = `start_attempts:${telegramUser.id}`;
      const canProceed = await redis.setRateLimit(rateLimitKey, 5, 3600);
      
      if (!canProceed) {
        await ctx.reply(
          '⏳ <b>Limite de tentativas atingido</b>\n\n' +
          'Você pode tentar novamente em 1 hora.\n\n' +
          'Se você já se cadastrou na Blofin, entre em contato com o suporte.',
          { parse_mode: 'HTML' }
        );
        return;
      }
    } else {
      console.log(`🧪 Rate limiting disabled for /start command - TEST MODE`);
    }

    // Verificar se já atingiu o limite de tentativas de verificação (skip in test mode)
    if (!isTestMode && user.verification_attempts >= 3) {
      await ctx.reply(
        '❌ <b>Limite de tentativas de verificação atingido</b>\n\n' +
        'Você já tentou verificar seu cadastro 3 vezes sem sucesso.\n\n' +
        '📞 Entre em contato com o suporte para verificação manual.\n' +
        `🎯 Seu token: <code>${user.referral_token}</code>`,
        { parse_mode: 'HTML' }
      );
      return;
    } else if (isTestMode && user.verification_attempts >= 3) {
      console.log(`🧪 Bypassing verification attempts limit (${user.verification_attempts}) - TEST MODE`);
    }

    const referralLink = blofinService.generateReferralLink(telegramUser.id.toString());
    
    const welcomeMessage = `🚀 *Bem\\-vindo ao Bot de Calls Cripto\\!*

👋 Olá ${firstName}\\!

Para ter acesso ao nosso grupo exclusivo de calls cripto:

*🏦 PASSO 1: Cadastro na Blofin*
• Se cadastre usando OBRIGATORIAMENTE este link:
🔗 [Clique aqui para se cadastrar na Blofin](${referralLink})
📎 Link direto: ${referralLink}

*📺 PASSO 2: Tutorial em Vídeo*
• Assista como encontrar seu UID:
🎥 [Tutorial \\- Como encontrar seu UID](https://www.loom.com/share/seu-tutorial-uid)
📎 Link direto: https://www\\.loom\\.com/share/seu\\-tutorial\\-uid

*🔍 PASSO 3: Envie seu UID*
• Após se cadastrar, me envie seu UID da Blofin
• É um número como: 23062566953
• Encontre em: Perfil → Configurações → UID

📝 *Agora me envie apenas seu UID da Blofin:*`;

    await ctx.reply(welcomeMessage, { parse_mode: 'MarkdownV2' });

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
    
    console.log(`🔍 UID VERIFICATION STARTED | user=@${telegramUser.username} | uid=${uidInput}`);
    
    // Validar formato do UID (apenas números, entre 8-15 dígitos)
    if (!/^\d{8,15}$/.test(uidInput)) {
      console.log(`❌ INVALID UID FORMAT | uid=${uidInput} | pattern=failed`);
      await ctx.reply(
        '❌ *UID inválido*\n\n' +
        '🔢 O UID deve conter apenas números e ter entre 8\\-15 dígitos\\.\n\n' +
        '💡 *Exemplo:* 23062566953\n\n' +
        '📝 Tente novamente enviando apenas o UID:',
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }

    console.log(`✅ UID FORMAT VALID | uid=${uidInput} | proceeding to API verification`);
    await ctx.reply('🔍 *Verificando seu UID na Blofin\\.\\.\\.*\n\nPor favor, aguarde\\.\\.\\.', { parse_mode: 'MarkdownV2' });

    // Limpar estado de espera
    pendingUidInput.delete(telegramUser.id);

    // Incrementar tentativas de verificação (skip in test mode)
    const isTestMode = process.env.NODE_ENV === 'development' || 
                      process.env.DISABLE_RATE_LIMIT === 'true' ||
                      process.env.TEST_MODE === 'true';
    
    if (!isTestMode) {
      await userService.incrementVerificationAttempts(pendingState.userId);
      console.log(`📊 VERIFICATION ATTEMPTS INCREMENTED | userId=${pendingState.userId}`);
    } else {
      console.log(`🧪 Skipping verification attempts increment - TEST MODE`);
    }

    // Verificar UID na API da Blofin
    console.log(`🌐 CALLING BLOFIN API | uid=${uidInput} | starting verification...`);
    const startTime = Date.now();
    const isValidAffiliate = await blofinService.verifyUserByUid(uidInput);
    const endTime = Date.now();
    console.log(`🌐 BLOFIN API RESPONSE | uid=${uidInput} | result=${isValidAffiliate} | duration=${endTime - startTime}ms`);

    if (isValidAffiliate) {
      console.log(`✅ VERIFICATION SUCCESS | uid=${uidInput} | user=@${telegramUser.username} | marking as verified...`);
      
      // Marcar como verificado e dar acesso
      await userService.markUserAsVerified(pendingState.userId);
      console.log(`✅ USER MARKED AS VERIFIED | userId=${pendingState.userId}`);
      
      // Inicializar serviço de segurança se necessário
      if (!groupSecurity && ctx.telegram) {
        groupSecurity = new GroupSecurityService(ctx.telegram);
      }
      
      // Criar link de convite único para usuário verificado
      let inviteMessage = '';
      try {
        if (groupSecurity) {
          console.log(`🔗 CREATING INVITE LINK | user=@${telegramUser.username}`);
          const success = await groupSecurity.addVerifiedUser(telegramUser.id);
          if (success) {
            inviteMessage = '\n\n🔗 *Um link de convite único foi criado para você\\!*\n' +
                          '📨 Verifique suas mensagens privadas para o link de acesso\\.';
            console.log(`✅ INVITE LINK CREATED | user=@${telegramUser.username}`);
          }
        }
      } catch (error) {
        console.warn(`❌ INVITE LINK CREATION FAILED | user=@${telegramUser.username} | error:`, error);
        inviteMessage = `\n\n🔗 *Link do grupo:* https://t\\.me/c/${config.telegram.groupId.replace('-100', '')}/1`;
      }
      
      await ctx.reply(
        '🎉 *Verificação concluída com sucesso\\!*\n\n' +
        '✅ Seu UID foi encontrado nos nossos afiliados\\!\n' +
        '🚀 Você agora tem acesso ao grupo de calls cripto\\!' +
        inviteMessage + '\n\n' +
        '💡 Bem\\-vindo ao grupo\\! Aproveite as calls exclusivas\\.',
        { parse_mode: 'MarkdownV2' }
      );

      // Log da verificação bem-sucedida
      console.log(`✅ VERIFICATION COMPLETE | user=@${telegramUser.username} | uid=${uidInput} | SUCCESS`);
      
    } else {
      console.log(`❌ VERIFICATION FAILED | uid=${uidInput} | user=@${telegramUser.username} | not found in affiliates`);
      
      const user = await userService.getUserByTelegramId(pendingState.userId.toString());
      const remainingAttempts = user ? 3 - user.verification_attempts : 0;
      
      console.log(`📊 VERIFICATION ATTEMPTS | user=@${telegramUser.username} | remaining=${remainingAttempts}`);
      
      const userReferralLink = blofinService.generateReferralLink(telegramUser.id.toString());
      await ctx.reply(
        '❌ *UID não encontrado*\n\n' +
        '🔍 Não conseguimos encontrar este UID nos nossos afiliados\\.\n\n' +
        '*Possíveis causas:*\n' +
        '• Você não se cadastrou usando nosso link de afiliado\n' +
        '• O UID está incorreto\n' +
        '• O cadastro é muito recente \\(aguarde alguns minutos\\)\n\n' +
        `🔗 *Certifique\\-se de usar este link:*\n[🔗 Clique aqui para se cadastrar na Blofin](${userReferralLink})\n📎 Link direto: ${userReferralLink}\n\n` +
        `⚠️ Tentativas restantes: ${remainingAttempts}\n\n` +
        '💡 Use /start novamente para tentar com outro UID\\.',
        { parse_mode: 'MarkdownV2' }
      );
      
      console.log(`❌ VERIFICATION COMPLETE | user=@${telegramUser.username} | uid=${uidInput} | FAILED`);
    }

  } catch (error) {
    console.error('Error in handleStartUidInput:', error);
    await ctx.reply(
      '❌ <b>Erro durante a verificação</b>\n\n' +
      'Ocorreu um erro ao verificar seu UID. Tente novamente em alguns instantes.\n\n' +
      'Se o problema persistir, entre em contato com o suporte.',
      { parse_mode: 'HTML' }
    );
  }
}

// Exportar estado para uso no bot principal
export { pendingUidInput };