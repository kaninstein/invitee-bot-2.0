import { Context } from 'telegraf';
import { blofinService } from '../../services/blofinService';

export async function helpCommand(ctx: Context) {
  try {
    const telegramUser = ctx.from;
    const helpMessage = `
🆘 **Central de Ajuda**

🤖 **Sobre este bot:**
Este bot controla o acesso ao nosso grupo exclusivo de calls cripto. Para participar, você precisa se cadastrar na Blofin usando nosso link de afiliado.

📋 **Comandos disponíveis:**

🚀 **/start** - Tela inicial e instruções
🔐 **/register** - Verificar seu cadastro na Blofin
📊 **/status** - Ver status da sua conta
🆘 **/help** - Esta mensagem de ajuda

📖 **Como funciona:**

1️⃣ **Cadastro na Blofin**
   • Use OBRIGATORIAMENTE nosso link de afiliado
   • Complete o processo de registro
   • Anote seu UID da Blofin (ex: 23062566953)

2️⃣ **Verificação por UID**
   • Use o comando /register
   • O bot pedirá seu UID da Blofin
   • Encontre seu UID em: Perfil → Configurações → UID
   • Você tem até 3 tentativas de verificação

3️⃣ **Acesso ao grupo**
   • Após verificar seu UID, você receberá acesso automático
   • Link do grupo será enviado pelo bot
   • Aproveite as calls exclusivas!

🔗 **Link para cadastro na Blofin:**
${blofinService.generateReferralLink(telegramUser?.id.toString())}

❓ **Problemas comuns:**

**"UID não encontrado"**
• Verifique se usou nosso link de afiliado para se cadastrar
• Confirme se o UID está correto (apenas números)
• Aguarde alguns minutos após o cadastro
• Certifique-se de que completou o registro

**"UID inválido"**
• O UID deve ter entre 8-15 dígitos
• Use apenas números, sem letras ou símbolos
• Exemplo correto: 23062566953

**"Limite de tentativas atingido"**
• Aguarde 1 hora para tentar novamente
• Entre em contato com suporte se necessário

**"Erro durante verificação"**
• Tente novamente em alguns instantes
• Verifique sua conexão com internet
• Contate suporte se persistir

📞 **Suporte:**
Se você continuar tendo problemas:

1️⃣ Verifique se seguiu todos os passos corretamente
2️⃣ Aguarde alguns minutos e tente novamente
3️⃣ Entre em contato com @seu_usuario_suporte
4️⃣ Informe seu token de verificação (use /status)

⚠️ **Importante:**
• Só damos suporte para usuários que se cadastraram via nosso link
• Mantenha seu token de verificação seguro
• Não compartilhe suas credenciais com terceiros

🎯 **Dicas:**
• Use /status regularmente para acompanhar seu progresso
• Anote seu UID da Blofin após se cadastrar
• Aguarde alguns minutos após o cadastro antes de verificar
• Certifique-se de usar APENAS nosso link de afiliado

💡 **Lembre-se:** Este é um grupo exclusivo para usuários verificados da Blofin!
    `.trim();

    await ctx.reply(helpMessage, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });

  } catch (error) {
    console.error('Error in help command:', error);
    await ctx.reply(
      '❌ Ocorreu um erro ao exibir a ajuda. Tente novamente em alguns instantes.'
    );
  }
}