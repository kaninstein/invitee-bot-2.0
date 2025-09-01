import { Context } from 'telegraf';
import { userService } from '../../services/userService';
import { blofinService } from '../../services/blofinService';
import { config } from '../../config';
import { redis } from '../../config/redis';
import { GroupSecurityService } from '../../services/groupSecurityService';
import { i18nService } from '../../services/i18nService';


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
        i18nService.t('start.accessMessage', {
          firstName,
          groupId: config.telegram.groupId.replace('-100', '')
        })
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
          i18nService.t('start.rateLimitReached'),
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
        i18nService.t('start.verificationLimitReached', { token: user.referral_token }),
        { parse_mode: 'HTML' }
      );
      return;
    } else if (isTestMode && user.verification_attempts >= 3) {
      console.log(`🧪 Bypassing verification attempts limit (${user.verification_attempts}) - TEST MODE`);
    }

    const referralLink = blofinService.generateReferralLink(telegramUser.id.toString());
    
    const welcomeMessage = `${i18nService.tMarkdown('start.welcome')}

${i18nService.tMarkdown('start.hello', { firstName })}

${i18nService.tMarkdown('start.instructions')}

*${i18nService.tMarkdown('start.step1.title')}*
${i18nService.tMarkdown('start.step1.description', { referralLink })}

*${i18nService.tMarkdown('start.step2.title')}*
${i18nService.tMarkdown('start.step2.description', { loomUrl: config.bot.loomTutorialUrl })}

*${i18nService.tMarkdown('start.step3.title')}*
${i18nService.tMarkdown('start.step3.description')}

${i18nService.tMarkdown('start.sendUid')}`;

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
      i18nService.t('general.error')
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
        i18nService.tMarkdown('uid.invalid'),
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }

    console.log(`✅ UID FORMAT VALID | uid=${uidInput} | proceeding to API verification`);
    await ctx.reply(i18nService.tMarkdown('uid.verifying'), { parse_mode: 'MarkdownV2' });

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
      
      try {
        // Marcar como verificado e dar acesso
        await userService.markUserAsVerified(pendingState.userId, uidInput);
        console.log(`✅ USER MARKED AS VERIFIED | userId=${pendingState.userId}`);
      } catch (error) {
        // Tratar erro de UID duplicado
        if (error instanceof Error && error.message.includes('já está sendo usado')) {
          console.log(`❌ DUPLICATE UID ERROR | uid=${uidInput} | user=@${telegramUser.username} | ${error.message}`);
          
          await ctx.reply(
            '❌ *UID já cadastrado*\n\n' +
            '⚠️ Este UID já está sendo usado por outro usuário\\.\n\n' +
            '*Possíveis causas:*\n' +
            '• Você já se verificou anteriormente\n' +
            '• Outra pessoa já usou este UID\n' +
            '• Erro no sistema\n\n' +
            '📞 *Entre em contato com o suporte* para resolver esta situação\\.\n\n' +
            '💡 Se você tem certeza que este é seu UID, forneça comprovantes ao suporte\\.',
            { parse_mode: 'MarkdownV2' }
          );
          return;
        }
        
        // Re-lançar outros erros
        throw error;
      }
      
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
            inviteMessage = '\n\n' + i18nService.tMarkdown('group.inviteLinkCreated');
            console.log(`✅ INVITE LINK CREATED | user=@${telegramUser.username}`);
          }
        }
      } catch (error) {
        console.warn(`❌ INVITE LINK CREATION FAILED | user=@${telegramUser.username} | error:`, error);
        inviteMessage = '\n\n' + i18nService.tMarkdown('group.inviteLinkFailed', {
          groupId: config.telegram.groupId.replace('-100', '')
        });
      }
      
      await ctx.reply(
        i18nService.tMarkdown('uid.success', { inviteMessage }),
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
        i18nService.tMarkdown('uid.notFound', {
          referralLink: userReferralLink,
          remainingAttempts
        }),
        { parse_mode: 'MarkdownV2' }
      );
      
      console.log(`❌ VERIFICATION COMPLETE | user=@${telegramUser.username} | uid=${uidInput} | FAILED`);
    }

  } catch (error) {
    console.error('Error in handleStartUidInput:', error);
    await ctx.reply(
      i18nService.t('general.verificationError'),
      { parse_mode: 'HTML' }
    );
  }
}

// Exportar estado para uso no bot principal
export { pendingUidInput };