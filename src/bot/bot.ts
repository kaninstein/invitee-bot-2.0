import { Telegraf } from 'telegraf';
import { config } from '../config';

// Middleware
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { loggingMiddleware } from '../middleware/logging';
import { errorHandler } from '../middleware/error';

// Commands
import { startCommand, handleStartUidInput, pendingUidInput } from './commands/start';
import { statusCommand } from './commands/status';
import { helpCommand } from './commands/help';
import { statsCommand, listUsersCommand, revokeAccessCommand, broadcastCommand } from './commands/admin';

export function setupBot(bot: Telegraf) {
  // Error handling middleware (deve ser o primeiro)
  bot.use(errorHandler());
  
  // Logging middleware
  bot.use(loggingMiddleware());
  
  // Rate limiting middleware
  bot.use(rateLimitMiddleware());
  
  // Auth middleware
  bot.use(authMiddleware());

  // Comandos básicos
  bot.command('start', startCommand);
  bot.command('status', statusCommand);
  bot.command('help', helpCommand);

  // Comandos administrativos
  bot.command('stats', statsCommand);
  bot.command('listusers', listUsersCommand);
  bot.command('revokeaccess', revokeAccessCommand);
  bot.command('broadcast', broadcastCommand);

  // Handler para mensagens não reconhecidas
  bot.on('text', async (ctx) => {
    const telegramUser = ctx.from;
    if (!telegramUser) return;

    // Verificar se o usuário está aguardando input de UID
    if (pendingUidInput.has(telegramUser.id)) {
      await handleStartUidInput(ctx);
      return;
    }

    const message = ctx.message.text.toLowerCase();
    
    // Respostas para mensagens comuns
    if (message.includes('ajuda') || message.includes('help')) {
      await helpCommand(ctx);
      return;
    }

    if (message.includes('status') || message.includes('situação')) {
      await statusCommand(ctx);
      return;
    }

    if (message.includes('registrar') || message.includes('verificar') || message.includes('cadastrar')) {
      await startCommand(ctx);
      return;
    }

    // Mensagem padrão para texto não reconhecido
    await ctx.reply(
      '🤖 **Comando não reconhecido**\n\n' +
      'Use um dos comandos disponíveis:\n\n' +
      '/start - Cadastro e verificação\n' +
      '/status - Ver seu status\n' +
      '/help - Ajuda e suporte\n\n' +
      '💡 Digite /start para começar.'
    );
  });

  // Handler para callback queries (botões inline)
  bot.on('callback_query', async (ctx) => {
    try {
      const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
      
      if (data === 'refresh_status') {
        await statusCommand(ctx);
        await ctx.answerCbQuery('Status atualizado!');
      } else if (data === 'help') {
        await helpCommand(ctx);
        await ctx.answerCbQuery();
      } else if (data === 'register') {
        await startCommand(ctx);
        await ctx.answerCbQuery('Iniciando verificação...');
      } else {
        await ctx.answerCbQuery('Ação não reconhecida.');
      }
    } catch (error) {
      console.error('Callback query error:', error);
      await ctx.answerCbQuery('Erro ao processar ação.');
    }
  });

  // Handler para novos membros em grupos
  bot.on('new_chat_members', async (ctx) => {
    try {
      const newMembers = ctx.message.new_chat_members;
      
      for (const member of newMembers) {
        if (member.is_bot) continue;
        
        // Verificar se o novo membro tem permissão para estar no grupo
        const user = await require('../services/userService').userService.getUserByTelegramId(member.id.toString());
        
        if (!user || !user.group_access) {
          // Remover usuário não autorizado
          try {
            await ctx.banChatMember(member.id);
            await ctx.reply(
              `🚫 **Usuário removido**\n\n` +
              `@${member.username || member.first_name} foi removido por não ter acesso autorizado.\n\n` +
              `💡 Para obter acesso, use nosso bot: @${ctx.botInfo.username}`
            );
          } catch (banError) {
            console.error('Error banning unauthorized user:', banError);
          }
        } else {
          // Dar boas-vindas ao usuário autorizado
          await ctx.reply(
            `🎉 **Bem-vindo ao grupo, ${member.first_name}!**\n\n` +
            `✅ Seu acesso foi verificado com sucesso.\n` +
            `📈 Aproveite nossas calls exclusivas de cripto!\n\n` +
            `💡 Use @${ctx.botInfo.username} para gerenciar sua conta.`
          );
        }
      }
    } catch (error) {
      console.error('New chat members error:', error);
    }
  });

  // Handler para membros que saíram
  bot.on('left_chat_member', async (ctx) => {
    try {
      const leftMember = ctx.message.left_chat_member;
      
      if (leftMember && !leftMember.is_bot) {
        console.log(`📤 User left group: ${leftMember.id} (@${leftMember.username})`);
        
        // Opcionalmente, revogar acesso no banco de dados
        // await userService.revokeGroupAccess(leftMember.id);
      }
    } catch (error) {
      console.error('Left chat member error:', error);
    }
  });

  // Logs de inicialização
  console.log('🤖 Bot setup completed');
  console.log('📋 Available commands:');
  console.log('  /start - Registration and verification (simplified flow)');
  console.log('  /status - Check user status');
  console.log('  /help - Help and support');
  console.log('  /stats - Admin statistics');
  console.log('  /listusers - Admin user list');
  console.log('  /revokeaccess - Admin revoke access');
  console.log('  /broadcast - Admin broadcast message');
}