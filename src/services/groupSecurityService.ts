import { Telegraf, Telegram } from 'telegraf';
import { config } from '../config';
import { logger } from '../utils/logger';
import { userService } from './userService';

export class GroupSecurityService {
  private telegram: Telegram;
  private groupId: string;

  constructor(bot: Telegraf | Telegram) {
    // Permitir receber tanto a instância completa do Telegraf quanto o objeto
    // Telegram diretamente. Isso evita erros ao passar apenas ctx.telegram.
    this.telegram = 'telegram' in bot ? bot.telegram : bot;
    this.groupId = config.telegram.groupId;
  }

  /**
   * Configura o grupo com segurança máxima na inicialização
   */
  async setupGroupSecurity(): Promise<boolean> {
    logger.info('GROUP_SECURITY', 'Configurando segurança do grupo...');
    
    try {
      // 1. Verificar se o bot é administrador do grupo
      await this.checkBotAdminStatus();
      
      // 2. Revogar todos os links de convite existentes
      await this.revokeExistingInviteLinks();
      
      // 3. Configurar permissões do grupo
      await this.configureGroupPermissions();
      
      // 4. Verificar configurações finais
      await this.verifySecurityConfiguration();
      
      logger.info('GROUP_SECURITY', '✅ Configuração de segurança do grupo concluída');
      return true;
      
    } catch (error) {
      logger.error('GROUP_SECURITY', 'Erro ao configurar segurança do grupo', error as Error);
      return false;
    }
  }

  /**
   * Verifica se o bot é administrador do grupo
   */
  private async checkBotAdminStatus(): Promise<void> {
    try {
      const botInfo = await this.telegram.getMe();
      const chatMember = await this.telegram.getChatMember(this.groupId, botInfo.id);
      
      if (chatMember.status !== 'administrator' && chatMember.status !== 'creator') {
        throw new Error('Bot não é administrador do grupo. Adicione o bot como administrador primeiro.');
      }
      
      // Verificar se o bot tem as permissões necessárias
      if (chatMember.status === 'administrator') {
        const requiredPerms = {
          can_invite_users: chatMember.can_invite_users,
          can_restrict_members: chatMember.can_restrict_members,
          can_manage_chat: chatMember.can_manage_chat,
        };
        
        const missingPerms = Object.entries(requiredPerms)
          .filter(([_, hasPermission]) => !hasPermission)
          .map(([permission]) => permission);
        
        if (missingPerms.length > 0) {
          logger.warn('GROUP_SECURITY', `Bot sem algumas permissões: ${missingPerms.join(', ')}`);
        }
      }
      
      logger.info('GROUP_SECURITY', `✅ Bot é ${chatMember.status} do grupo`);
      
    } catch (error) {
      logger.error('GROUP_SECURITY', 'Erro ao verificar status de admin do bot', error as Error);
      throw error;
    }
  }

  /**
   * Revoga todos os links de convite existentes
   */
  private async revokeExistingInviteLinks(): Promise<void> {
    try {
      logger.info('GROUP_SECURITY', 'Revogando links de convite existentes...');
      
      // Revogar link de convite primário se existir
      try {
        await this.telegram.revokeChatInviteLink(this.groupId, '');
        logger.info('GROUP_SECURITY', 'Link de convite primário revogado');
      } catch (error: any) {
        // Se não há link para revogar, está ok
        if (error.description && error.description.includes('not found')) {
          logger.info('GROUP_SECURITY', 'Nenhum link de convite primário para revogar');
        } else {
          logger.warn('GROUP_SECURITY', 'Erro ao revogar link primário', { error: (error as Error).message });
        }
      }
      
      // Exportar links de convite existentes e revogá-los
      try {
        const exportedLinks = await this.telegram.exportChatInviteLink(this.groupId);
        if (exportedLinks) {
          await this.telegram.revokeChatInviteLink(this.groupId, exportedLinks);
          logger.info('GROUP_SECURITY', 'Links exportados revogados');
        }
      } catch (error) {
        logger.info('GROUP_SECURITY', 'Nenhum link exportado para revogar');
      }
      
      logger.info('GROUP_SECURITY', '✅ Links de convite revogados');
      
    } catch (error) {
      logger.error('GROUP_SECURITY', 'Erro ao revogar links de convite', error as Error);
      throw error;
    }
  }

  /**
   * Configura permissões restritivas do grupo
   */
  private async configureGroupPermissions(): Promise<void> {
    try {
      logger.info('GROUP_SECURITY', 'Configurando permissões do grupo...');
      
      // Configurar permissões padrão para novos membros
      const restrictedPermissions = {
        can_send_messages: true,
        can_send_audios: true,
        can_send_documents: true,
        can_send_photos: true,
        can_send_videos: true,
        can_send_video_notes: true,
        can_send_voice_notes: true,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false, // CRÍTICO: membros não podem convidar outros
        can_pin_messages: false,
        can_manage_topics: false,
      };
      
      await this.telegram.setChatPermissions(this.groupId, restrictedPermissions);
      
      // Configurar título e descrição do grupo para deixar claro que é privado
      try {
        const chatInfo = await this.telegram.getChat(this.groupId);
        if ('description' in chatInfo) {
          const currentDescription = chatInfo.description || '';
          const securityNotice = '\n\n🔒 GRUPO PRIVADO - Acesso apenas por verificação do bot';
          
          if (!currentDescription.includes('GRUPO PRIVADO')) {
            await this.telegram.setChatDescription(
              this.groupId, 
              currentDescription + securityNotice
            );
          }
        }
      } catch (error) {
        logger.warn('GROUP_SECURITY', 'Não foi possível atualizar descrição do grupo', { error: (error as Error).message });
      }
      
      logger.info('GROUP_SECURITY', '✅ Permissões do grupo configuradas');
      
    } catch (error) {
      logger.error('GROUP_SECURITY', 'Erro ao configurar permissões', error as Error);
      throw error;
    }
  }

  /**
   * Verifica se as configurações de segurança estão ativas
   */
  private async verifySecurityConfiguration(): Promise<void> {
    try {
      logger.info('GROUP_SECURITY', 'Verificando configurações de segurança...');
      
      const chatInfo = await this.telegram.getChat(this.groupId);
      
      if ('permissions' in chatInfo && chatInfo.permissions) {
        const perms = chatInfo.permissions;
        
        // Verificações críticas
        const securityChecks = {
          'Membros não podem convidar outros': !perms.can_invite_users,
          'Membros não podem alterar info do grupo': !perms.can_change_info,
          'Membros não podem fazer polls': !perms.can_send_polls,
        };
        
        const failedChecks = Object.entries(securityChecks)
          .filter(([_, passed]) => !passed)
          .map(([check]) => check);
        
        if (failedChecks.length > 0) {
          logger.warn('GROUP_SECURITY', `Verificações de segurança falharam: ${failedChecks.join(', ')}`);
        } else {
          logger.info('GROUP_SECURITY', '✅ Todas as verificações de segurança passaram');
        }
      }
      
      // Verificar se há link de convite ativo (não deveria ter)
      try {
        const inviteLink = await this.telegram.exportChatInviteLink(this.groupId);
        if (inviteLink) {
          logger.warn('GROUP_SECURITY', '⚠️ Grupo ainda tem link de convite ativo');
        }
      } catch (error) {
        logger.info('GROUP_SECURITY', '✅ Nenhum link de convite ativo encontrado');
      }
      
    } catch (error) {
      logger.error('GROUP_SECURITY', 'Erro ao verificar configurações', error as Error);
      throw error;
    }
  }

  /**
   * Adiciona usuário verificado ao grupo
   */
  async addVerifiedUser(userId: number): Promise<boolean> {
    try {
      logger.info('GROUP_SECURITY', `Adicionando usuário verificado ${userId} ao grupo`);
      
      // Criar link de convite único para este usuário (expire em 1 hora)
      const expireDate = Math.floor(Date.now() / 1000) + 3600; // 1 hora
      
      const inviteLink = await this.telegram.createChatInviteLink(this.groupId, {
        member_limit: 1, // Apenas 1 pessoa pode usar
        expire_date: expireDate,
        name: `Verified_User_${userId}_${Date.now()}`,
      });
      
      logger.info('GROUP_SECURITY', `✅ Link de convite criado para usuário ${userId}`);
      return true;
      
    } catch (error) {
      logger.error('GROUP_SECURITY', `Erro ao adicionar usuário ${userId}`, error as Error);
      return false;
    }
  }

  /**
   * Remove usuário não verificado do grupo
   */
  async removeUnverifiedUser(userId: number, reason: string = 'Não verificado'): Promise<boolean> {
    try {
      logger.info('GROUP_SECURITY', `Removendo usuário não verificado ${userId}: ${reason}`);
      
      await this.telegram.banChatMember(this.groupId, userId);
      
      // Desbanir imediatamente para permitir re-entrada após verificação
      await this.telegram.unbanChatMember(this.groupId, userId);
      
      logger.info('GROUP_SECURITY', `✅ Usuário ${userId} removido do grupo`);
      return true;
      
    } catch (error) {
      logger.error('GROUP_SECURITY', `Erro ao remover usuário ${userId}`, error as Error);
      return false;
    }
  }

  /**
   * Monitora novos membros e verifica se são permitidos
   */
  async handleNewMember(userId: number, addedBy?: number): Promise<void> {
    try {
      // Se foi adicionado por um admin, permitir
      if (addedBy) {
        const adderMember = await this.telegram.getChatMember(this.groupId, addedBy);
        if (adderMember.status === 'administrator' || adderMember.status === 'creator') {
          logger.info('GROUP_SECURITY', `Usuário ${userId} adicionado por admin ${addedBy} - permitido`);
          return;
        }
      }
      
      // Verificar se o usuário está na lista de verificados
      // (esta verificação será implementada no userService)
      const isVerified = await this.checkUserVerificationStatus(userId);
      
      if (!isVerified) {
        logger.warn('GROUP_SECURITY', `Usuário não verificado ${userId} detectado no grupo`);
        await this.removeUnverifiedUser(userId, 'Entrada sem verificação');
        
        // Enviar mensagem explicativa (se possível)
        try {
          await this.telegram.sendMessage(
            userId,
            '❌ <b>Acesso negado ao grupo</b>\n\n' +
            'Você foi removido do grupo porque não passou pelo processo de verificação.\n\n' +
            '✅ Para ter acesso, use o comando /start no bot e complete a verificação.',
            { parse_mode: 'HTML' }
          );
        } catch (error) {
          logger.warn('GROUP_SECURITY', `Não foi possível enviar mensagem para ${userId}`, { error: (error as Error).message });
        }
      }
      
    } catch (error) {
      logger.error('GROUP_SECURITY', `Erro ao processar novo membro ${userId}`, error as Error);
    }
  }

  /**
   * Verifica status de verificação do usuário
   */
  private async checkUserVerificationStatus(userId: number): Promise<boolean> {
    try {
      const user = await userService.getUserByTelegramId(userId.toString());
      return user ? user.group_access === true : false;
    } catch (error) {
      logger.error('GROUP_SECURITY', `Erro ao verificar status do usuário ${userId}`, error as Error);
      return false; // Modo seguro: negar acesso em caso de erro
    }
  }
}