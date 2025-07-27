import { Context } from 'telegraf';
import { userService } from '../../services/userService';
import { blofinService } from '../../services/blofinService';

export async function statusCommand(ctx: Context) {
  try {
    const telegramUser = ctx.from;
    if (!telegramUser) {
      await ctx.reply('❌ Erro ao obter informações do usuário.');
      return;
    }

    const user = await userService.getUserByTelegramId(telegramUser.id.toString());
    if (!user) {
      await ctx.reply(
        '❌ **Usuário não encontrado**\n\n' +
        'Use /start para se registrar primeiro.'
      );
      return;
    }

    // Obter sessão de verificação ativa (se houver)
    const activeSession = await userService.getActiveVerificationSession(user.id);

    const statusIcon = user.group_access ? '✅' : user.blofin_verified ? '⏳' : '❌';
    const statusText = user.group_access 
      ? 'Acesso liberado' 
      : user.blofin_verified 
        ? 'Verificado, aguardando acesso' 
        : 'Não verificado';

    const createdAt = new Date(user.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let statusMessage = `
📊 **Status da sua conta**

👤 **Usuário:** ${telegramUser.first_name}${telegramUser.username ? ` (@${telegramUser.username})` : ''}
🆔 **ID Telegram:** \`${telegramUser.id}\`
📅 **Registrado em:** ${createdAt}

${statusIcon} **Status:** ${statusText}
🔐 **Verificado na Blofin:** ${user.blofin_verified ? '✅ Sim' : '❌ Não'}
🎯 **Acesso ao grupo:** ${user.group_access ? '✅ Liberado' : '❌ Bloqueado'}
🔄 **Tentativas de verificação:** ${user.verification_attempts}/3

🎫 **Token de verificação:** \`${user.referral_token}\`
    `.trim();

    // Adicionar informações da sessão ativa
    if (activeSession) {
      const expiresAt = new Date(activeSession.expires_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      statusMessage += `\n\n⏰ **Sessão de verificação ativa**\n📅 Expira em: ${expiresAt}`;
    }

    // Adicionar próximos passos baseado no status
    if (!user.blofin_verified) {
      statusMessage += `\n\n📋 **Próximos passos:**\n`;
      statusMessage += `1️⃣ Cadastre-se na Blofin usando nosso link\n`;
      statusMessage += `2️⃣ Use /register para verificar seu cadastro\n\n`;
      statusMessage += `🔗 **Link de cadastro:**\n${blofinService.generateReferralLink(telegramUser.id.toString())}`;
    } else if (user.blofin_verified && !user.group_access) {
      statusMessage += `\n\n⏳ **Aguardando liberação do acesso ao grupo...**\n`;
      statusMessage += `Entre em contato com o suporte se necessário.`;
    } else if (user.group_access) {
      statusMessage += `\n\n🎉 **Parabéns! Você tem acesso total!**\n`;
      statusMessage += `🔗 [Clique aqui para entrar no grupo](https://t.me/${Math.abs(parseInt(config.telegram.groupId.replace('-100', '')))})`;
    }

    // Adicionar comandos disponíveis
    statusMessage += `\n\n🤖 **Comandos disponíveis:**\n`;
    statusMessage += `/start - Tela inicial\n`;
    statusMessage += `/register - Verificar cadastro na Blofin\n`;
    statusMessage += `/status - Ver este status\n`;
    statusMessage += `/help - Ajuda e suporte`;

    await ctx.reply(statusMessage, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });

  } catch (error) {
    console.error('Error in status command:', error);
    await ctx.reply(
      '❌ **Erro ao obter status**\n\n' +
      'Ocorreu um erro ao buscar suas informações. Tente novamente em alguns instantes.'
    );
  }
}