import i18next from 'i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Start command messages
      'start.welcome': '🚀 *Welcome to the Crypto Calls Bot\\!*',
      'start.hello': '👋 Hello {{firstName}}\\!',
      'start.accessMessage': '🎉 Hello {{firstName}}!\n\n✅ You already have access to the crypto calls group!\n\n🔗 [Click here to join the group](https://t.me/c/{{groupId}}/1)\n\n💡 Use /status to check your current status.',
      'start.instructions': 'To have access to our exclusive crypto calls group:',
      'start.step1.title': '🏦 STEP 1: Register on Blofin',
      'start.step1.description': '• Register using this MANDATORY link:\n🔗 [Click here to register on Blofin]({{referralLink}})\n📎 Direct link: {{referralLink}}',
      'start.step2.title': '📺 STEP 2: Video Tutorial',
      'start.step2.description': '• Watch how to find your UID:\n🎥 [Tutorial - How to find your UID]({{loomUrl}})\n📎 Direct link: {{loomUrl}}',
      'start.step3.title': '🔍 STEP 3: Send your UID',
      'start.step3.description': '• After registering, send me your Blofin UID\n• It\'s a number like: 23062566953\n• Find it at: Profile → Settings → UID',
      'start.sendUid': '📝 **Now send me only your Blofin UID:**',
      'start.rateLimitReached': '⏳ **Rate limit reached**\n\nYou can try again in 1 hour.\n\nIf you have already registered on Blofin, contact support.',
      'start.verificationLimitReached': '❌ **Verification attempts limit reached**\n\nYou have already tried to verify your registration 3 times without success.\n\n📞 Contact support for manual verification.\n🎯 Your token: `{{token}}`',

      // UID verification messages
      'uid.invalid': '❌ **Invalid UID**\n\n🔢 The UID must contain only numbers and have 8-15 digits.\n\n💡 **Example:** 23062566953\n\n📝 Try again by sending only the UID:',
      'uid.verifying': '🔍 **Verifying your UID on Blofin...**\n\nPlease wait...',
      'uid.success': '🎉 **Verification completed successfully!**\n\n✅ Your UID was found in our affiliates!\n🚀 You now have access to the crypto calls group!{{inviteMessage}}\n\n💡 Welcome to the group! Enjoy the exclusive calls.',
      'uid.duplicate': '❌ **UID already registered**\n\n⚠️ This UID is already being used by another user.\n\n**Possible causes:**\n• You have already verified before\n• Another person already used this UID\n• System error\n\n📞 **Contact support** to resolve this situation.\n\n💡 If you are sure this is your UID, provide proof to support.',
      'uid.notFound': '❌ **UID not found**\n\n🔍 We could not find this UID in our affiliates.\n\n**Possible causes:**\n• You did not register using our affiliate link\n• The UID is incorrect\n• The registration is too recent (wait a few minutes)\n\n🔗 **Make sure to use this link:**\n[🔗 Click here to register on Blofin]({{referralLink}})\n📎 Direct link: {{referralLink}}\n\n⚠️ Remaining attempts: {{remainingAttempts}}\n\n💡 Use /start again to try with another UID.',

      // Help command messages
      'help.title': '🆘 **Help Center**',
      'help.aboutBot': '🤖 **About this bot:**\nThis bot controls access to our exclusive crypto calls group. To participate, you need to register on Blofin using our affiliate link.',
      'help.availableCommands': '📋 **Available commands:**',
      'help.commands.start': '🚀 **/start** - Initial screen and instructions',
      'help.commands.register': '🔐 **/register** - Verify your Blofin registration',
      'help.commands.status': '📊 **/status** - View your account status',
      'help.commands.help': '🆘 **/help** - This help message',

      // General messages
      'general.error': '❌ An error occurred while processing your request. Please try again in a few moments.\n\nIf the problem persists, contact support.',
      'general.unknownCommand': '🤖 **Command not recognized**\n\nUse one of the available commands:\n\n/start - Registration and verification\n/status - View your status\n/help - Help and support\n\n💡 Type /start to begin.'
    }
  },
  pt: {
    translation: {
      // Start command messages
      'start.welcome': '🚀 **Bem-vindo ao Bot de Calls Cripto!**',
      'start.hello': '👋 Olá {{firstName}}!',
      'start.accessMessage': '🎉 Olá {{firstName}}!\n\n✅ Você já tem acesso ao grupo de calls cripto!\n\n🔗 [Clique aqui para entrar no grupo](https://t.me/c/{{groupId}}/1)\n\n💡 Use /status para verificar seu status atual.',
      'start.instructions': 'Para ter acesso ao nosso grupo exclusivo de calls cripto:',
      'start.step1.title': '🏦 PASSO 1: Cadastro na Blofin',
      'start.step1.description': '• Se cadastre usando OBRIGATORIAMENTE este link:\n🔗 [Clique aqui para se cadastrar na Blofin]({{referralLink}})\n📎 Link direto: {{referralLink}}',
      'start.step2.title': '📺 PASSO 2: Tutorial em Vídeo',
      'start.step2.description': '• Assista como encontrar seu UID:\n🎥 [Tutorial - Como encontrar seu UID]({{loomUrl}})\n📎 Link direto: {{loomUrl}}',
      'start.step3.title': '🔍 PASSO 3: Envie seu UID',
      'start.step3.description': '• Após se cadastrar, me envie seu UID da Blofin\n• É um número como: 23062566953\n• Encontre em: Perfil → Configurações → UID',
      'start.sendUid': '📝 **Agora me envie apenas seu UID da Blofin:**',
      'start.rateLimitReached': '⏳ **Limite de tentativas atingido**\n\nVocê pode tentar novamente em 1 hora.\n\nSe você já se cadastrou na Blofin, entre em contato com o suporte.',
      'start.verificationLimitReached': '❌ **Limite de tentativas de verificação atingido**\n\nVocê já tentou verificar seu cadastro 3 vezes sem sucesso.\n\n📞 Entre em contato com o suporte para verificação manual.\n🎯 Seu token: `{{token}}`',

      // UID verification messages
      'uid.invalid': '❌ **UID inválido**\n\n🔢 O UID deve conter apenas números e ter entre 8-15 dígitos.\n\n💡 **Exemplo:** 23062566953\n\n📝 Tente novamente enviando apenas o UID:',
      'uid.verifying': '🔍 **Verificando seu UID na Blofin...**\n\nPor favor, aguarde...',
      'uid.success': '🎉 **Verificação concluída com sucesso!**\n\n✅ Seu UID foi encontrado nos nossos afiliados!\n🚀 Você agora tem acesso ao grupo de calls cripto!{{inviteMessage}}\n\n💡 Bem-vindo ao grupo! Aproveite as calls exclusivas.',
      'uid.duplicate': '❌ **UID já cadastrado**\n\n⚠️ Este UID já está sendo usado por outro usuário.\n\n**Possíveis causas:**\n• Você já se verificou anteriormente\n• Outra pessoa já usou este UID\n• Erro no sistema\n\n📞 **Entre em contato com o suporte** para resolver esta situação.\n\n💡 Se você tem certeza que este é seu UID, forneça comprovantes ao suporte.',
      'uid.notFound': '❌ **UID não encontrado**\n\n🔍 Não conseguimos encontrar este UID nos nossos afiliados.\n\n**Possíveis causas:**\n• Você não se cadastrou usando nosso link de afiliado\n• O UID está incorreto\n• O cadastro é muito recente (aguarde alguns minutos)\n\n🔗 **Certifique-se de usar este link:**\n[🔗 Clique aqui para se cadastrar na Blofin]({{referralLink}})\n📎 Link direto: {{referralLink}}\n\n⚠️ Tentativas restantes: {{remainingAttempts}}\n\n💡 Use /start novamente para tentar com outro UID.',

      // Help command messages
      'help.title': '🆘 **Central de Ajuda**',
      'help.aboutBot': '🤖 **Sobre este bot:**\nEste bot controla o acesso ao nosso grupo exclusivo de calls cripto. Para participar, você precisa se cadastrar na Blofin usando nosso link de afiliado.',
      'help.availableCommands': '📋 **Comandos disponíveis:**',
      'help.commands.start': '🚀 **/start** - Tela inicial e instruções',
      'help.commands.register': '🔐 **/register** - Verificar seu cadastro na Blofin',
      'help.commands.status': '📊 **/status** - Ver status da sua conta',
      'help.commands.help': '🆘 **/help** - Esta mensagem de ajuda',

      // General messages
      'general.error': '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente em alguns instantes.\n\nSe o problema persistir, entre em contato com o suporte.',
      'general.unknownCommand': '🤖 **Comando não reconhecido**\n\nUse um dos comandos disponíveis:\n\n/start - Cadastro e verificação\n/status - Ver seu status\n/help - Ajuda e suporte\n\n💡 Digite /start para começar.'
    }
  }
};

class I18nService {
  private static instance: I18nService;
  private initialized = false;

  private constructor() {}

  public static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    const defaultLanguage = process.env.DEFAULT_LANGUAGE || 'pt';
    const fallbackLanguage = process.env.FALLBACK_LANGUAGE || 'en';

    await i18next.init({
      lng: defaultLanguage,
      fallbackLng: fallbackLanguage,
      resources,
      interpolation: {
        escapeValue: false
      }
    });

    this.initialized = true;
    console.log(`🌐 I18n initialized with default language: ${defaultLanguage}, fallback: ${fallbackLanguage}`);
  }

  public t(key: string, options?: any): string {
    if (!this.initialized) {
      console.warn('I18n not initialized, using fallback');
      return key;
    }
    return i18next.t(key, options) as string;
  }

  public changeLanguage(language: string): void {
    if (!this.initialized) {
      console.warn('I18n not initialized, cannot change language');
      return;
    }
    i18next.changeLanguage(language);
    console.log(`🌐 Language changed to: ${language}`);
  }

  public getCurrentLanguage(): string {
    return i18next.language || 'pt';
  }

  public getAvailableLanguages(): string[] {
    return ['en', 'pt'];
  }

  public escapeMarkdownV2(text: string): string {
    // For MarkdownV2, escape special characters but preserve intentional markdown formatting
    return text.replace(/([_~`>#+=|{}.!-])/g, '\\$1');
  }

  public tMarkdown(key: string, options?: any): string {
    const translated = this.t(key, options);
    // Don't escape the translated text since it should contain proper markdown
    return translated;
  }
}

export const i18nService = I18nService.getInstance();