import { Context } from 'telegraf';
import { userService } from '../../services/userService';
import { blofinService } from '../../services/blofinService';
import { config } from '../../config';

// Lista de admins (Telegram IDs)
const ADMIN_IDS = [
  '361492211', // Pedro - Admin principal
];

function isAdmin(userId: number): boolean {
  return ADMIN_IDS.includes(userId.toString());
}

export async function statsCommand(ctx: Context) {
  try {
    const telegramUser = ctx.from;
    if (!telegramUser || !isAdmin(telegramUser.id)) {
      await ctx.reply('❌ Comando disponível apenas para administradores.');
      return;
    }

    await ctx.reply('📊 Gerando estatísticas...');

    // Obter estatísticas dos usuários
    const userStats = await userService.getUserStats();
    
    // Tentar obter estatísticas da Blofin
    let blofinStats = null;
    try {
      const blofinResponse = await blofinService.getAffiliateStats();
      blofinStats = blofinResponse.data;
    } catch (error) {
      console.log('Could not fetch Blofin stats:', error);
    }

    const statsMessage = `
📊 **Estatísticas do Bot**

👥 **Usuários:**
• Total de usuários: ${userStats.total}
• Verificados na Blofin: ${userStats.verified}
• Com acesso ao grupo: ${userStats.withGroupAccess}
• Registros nas últimas 24h: ${userStats.recentRegistrations}

📈 **Taxa de conversão:**
• Verificação: ${userStats.total > 0 ? ((userStats.verified / userStats.total) * 100).toFixed(1) : 0}%
• Acesso ao grupo: ${userStats.total > 0 ? ((userStats.withGroupAccess / userStats.total) * 100).toFixed(1) : 0}%

${blofinStats ? `
🏦 **Estatísticas Blofin:**
• Total de afiliados: ${blofinStats.totalInvitees || 'N/A'}
• Comissões: ${blofinStats.totalCommission || 'N/A'}
` : '⚠️ Estatísticas da Blofin não disponíveis'}

🕐 **Última atualização:** ${new Date().toLocaleString('pt-BR')}
    `.trim();

    await ctx.reply(statsMessage, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Error in stats command:', error);
    await ctx.reply('❌ Erro ao gerar estatísticas.');
  }
}

export async function listUsersCommand(ctx: Context) {
  try {
    const telegramUser = ctx.from;
    if (!telegramUser || !isAdmin(telegramUser.id)) {
      await ctx.reply('❌ Comando disponível apenas para administradores.');
      return;
    }

    const users = await userService.getUsersWithGroupAccess();
    
    if (users.length === 0) {
      await ctx.reply('📋 Não há usuários com acesso ao grupo no momento.');
      return;
    }

    let usersList = '👥 **Usuários com acesso ao grupo:**\n\n';
    
    users.slice(0, 20).forEach((user, index) => {
      const username = user.username ? `@${user.username}` : 'Sem username';
      const name = user.first_name || 'Sem nome';
      const date = new Date(user.updated_at).toLocaleDateString('pt-BR');
      
      usersList += `${index + 1}. **${name}** (${username})\n`;
      usersList += `   • ID: \`${user.telegram_id}\`\n`;
      usersList += `   • Verificado em: ${date}\n\n`;
    });

    if (users.length > 20) {
      usersList += `... e mais ${users.length - 20} usuários.`;
    }

    await ctx.reply(usersList, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Error in listUsers command:', error);
    await ctx.reply('❌ Erro ao listar usuários.');
  }
}

export async function revokeAccessCommand(ctx: Context) {
  try {
    const telegramUser = ctx.from;
    if (!telegramUser || !isAdmin(telegramUser.id)) {
      await ctx.reply('❌ Comando disponível apenas para administradores.');
      return;
    }

    const message = ctx.message;
    if (!message || !('text' in message)) {
      await ctx.reply('❌ Formato inválido. Use: /revokeaccess <telegram_id>');
      return;
    }

    const args = message.text.split(' ');
    if (args.length !== 2) {
      await ctx.reply('❌ Formato inválido. Use: /revokeaccess <telegram_id>');
      return;
    }

    const targetTelegramId = args[1];
    const targetUser = await userService.getUserByTelegramId(targetTelegramId);

    if (!targetUser) {
      await ctx.reply('❌ Usuário não encontrado.');
      return;
    }

    if (!targetUser.group_access) {
      await ctx.reply('⚠️ Este usuário já não tem acesso ao grupo.');
      return;
    }

    await userService.revokeGroupAccess(targetUser.id);
    
    await ctx.reply(
      `✅ **Acesso revogado com sucesso!**\n\n` +
      `👤 Usuário: ${targetUser.first_name} (@${targetUser.username})\n` +
      `🆔 ID: \`${targetTelegramId}\`\n\n` +
      `❌ O acesso ao grupo foi removido.`
    );

    // Log da ação
    console.log(`🔒 Access revoked by admin ${telegramUser.id} for user ${targetTelegramId}`);

  } catch (error) {
    console.error('Error in revokeAccess command:', error);
    await ctx.reply('❌ Erro ao revogar acesso.');
  }
}

export async function broadcastCommand(ctx: Context) {
  try {
    const telegramUser = ctx.from;
    if (!telegramUser || !isAdmin(telegramUser.id)) {
      await ctx.reply('❌ Comando disponível apenas para administradores.');
      return;
    }

    const message = ctx.message;
    if (!message || !('text' in message)) {
      await ctx.reply('❌ Formato inválido. Use: /broadcast <mensagem>');
      return;
    }

    const broadcastText = message.text.replace('/broadcast ', '');
    if (!broadcastText || broadcastText === '/broadcast') {
      await ctx.reply('❌ Você precisa fornecer uma mensagem para transmitir.');
      return;
    }

    const users = await userService.getUsersWithGroupAccess();
    
    if (users.length === 0) {
      await ctx.reply('❌ Não há usuários para receber a transmissão.');
      return;
    }

    await ctx.reply(`📢 Iniciando transmissão para ${users.length} usuários...`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        await ctx.telegram.sendMessage(parseInt(user.telegram_id), broadcastText, {
          parse_mode: 'Markdown'
        });
        successCount++;
      } catch (error) {
        console.error(`Error sending broadcast to ${user.telegram_id}:`, error);
        errorCount++;
      }
      
      // Rate limiting para evitar spam
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    await ctx.reply(
      `📊 **Transmissão concluída!**\n\n` +
      `✅ Enviadas: ${successCount}\n` +
      `❌ Falharam: ${errorCount}\n` +
      `📈 Taxa de sucesso: ${((successCount / users.length) * 100).toFixed(1)}%`
    );

  } catch (error) {
    console.error('Error in broadcast command:', error);
    await ctx.reply('❌ Erro ao enviar transmissão.');
  }
}