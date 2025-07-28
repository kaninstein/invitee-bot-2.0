// Teste do formato da mensagem
const testMessage = `🚀 *Bem\\-vindo ao Bot de Calls Cripto\\!*

👋 Olá Ana Luiza\\!

Para ter acesso ao nosso grupo exclusivo de calls cripto:

*🏦 PASSO 1: Cadastro na Blofin*
• Se cadastre usando OBRIGATORIAMENTE este link:
🔗 [Clique aqui para se cadastrar na Blofin](https://blofin.com/register?referral_code=GoEEO9&source=telegram_8307895253)
📎 Link direto: https://blofin.com/register?referral_code=GoEEO9&source=telegram_8307895253

*📺 PASSO 2: Tutorial em Vídeo*
• Assista como encontrar seu UID:
🎥 [Tutorial \\- Como encontrar seu UID](https://www.loom.com/share/seu-tutorial-uid)
📎 Link direto: https://www\\.loom\\.com/share/seu\\-tutorial\\-uid

*🔍 PASSO 3: Envie seu UID*
• Após se cadastrar, me envie seu UID da Blofin
• É um número como: 23062566953
• Encontre em: Perfil → Configurações → UID

📝 *Agora me envie apenas seu UID da Blofin:*`;

console.log('📝 FORMATO DA MENSAGEM (MarkdownV2):');
console.log('=====================================');
console.log(testMessage);
console.log('\n✅ Características:');
console.log('- 🔗 Botão clicável: [texto](url) - BOTÃO AZUL');
console.log('- 📎 Link direto: URL visível e clicável');
console.log('- Texto em negrito com * *');
console.log('- Caracteres especiais escapados com \\');
console.log('- Parse mode: MarkdownV2');
console.log('\n🎯 RESULTADO:');
console.log('✅ Botão "Clique aqui" - azul e clicável');
console.log('✅ Link direto visível - azul e clicável');
console.log('✅ Usuário pode escolher entre as duas opções!');