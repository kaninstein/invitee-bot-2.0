# 🚀 Deploy no Easypanel - Guia Passo a Passo

## ⚠️ IMPORTANTE - Configurações Pendentes

Antes do deploy, você precisa configurar:

### 1. **Credenciais da API Blofin**
No arquivo `.env`, substitua:
```bash
BLOFIN_API_KEY=your_blofin_api_key_here
BLOFIN_SECRET_KEY=your_blofin_secret_key_here  
BLOFIN_PASSPHRASE=your_blofin_passphrase_here
YOUR_REFERRAL_CODE=your_referral_code_here
```

### 2. **ID do Admin**
No arquivo `src/bot/commands/admin.ts`, adicione seu ID:
```typescript
const ADMIN_IDS = [
  'SEU_TELEGRAM_ID_AQUI', // Descubra com @userinfobot
];
```

## 📋 Passos do Deploy

### 1. **Criar Repositório GitHub**
```bash
cd /Users/pedro/Desktop/bot-telegram
git init
git add .
git commit -m "Initial commit - Telegram crypto bot"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/bot-telegram.git
git push -u origin main
```

### 2. **Configurar no Easypanel**

1. **Criar Novo Serviço**
   - Vá para Easypanel → Create Service
   - Escolha "App"
   - Nome: `telegram-crypto-bot`

2. **Configurar Source**
   - Repository: `https://github.com/SEU_USUARIO/bot-telegram`
   - Branch: `main`
   - Build Command: `npm run build`
   - Start Command: `npm start`

3. **Environment Variables**
   Adicione TODAS essas variáveis:

```bash
TELEGRAM_BOT_TOKEN=8205778809:AAFI8P6I4d6XLHbgHO0qsSvsbZhCcxNp93k
TELEGRAM_GROUP_ID=-1002711959390
TELEGRAM_WEBHOOK_URL=https://SEU_DOMINIO.easypanel.host/webhook

BLOFIN_API_KEY=sua_api_key_blofin
BLOFIN_SECRET_KEY=sua_secret_key_blofin
BLOFIN_PASSPHRASE=sua_passphrase_blofin
BLOFIN_BASE_URL=https://openapi.blofin.com
YOUR_REFERRAL_CODE=seu_codigo_referral

DATABASE_URL=postgres://postgres:@662294Mb@painel.pedrocoelho.me:12124/bot-telegram?sslmode=disable
REDIS_URL=redis://default:@662294Mb@painel.pedrocoelho.me:12123

NODE_ENV=production
PORT=3000
JWT_SECRET=sua_chave_jwt_super_secreta_32_caracteres_aqui_2024_bot_telegram
ENCRYPTION_KEY=12345678901234567890123456789012

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
VERIFICATION_TIMEOUT_HOURS=24
MAX_VERIFICATION_ATTEMPTS=3
```

4. **Configurar Domínio**
   - Em "Domains", adicione seu domínio
   - Ative SSL automático
   - Anote a URL do webhook

5. **Deploy**
   - Clique em "Deploy"
   - Monitore os logs

### 3. **Verificar Deploy**

1. **Health Check**
   ```
   https://SEU_DOMINIO.easypanel.host/health
   ```

2. **Testar Bot**
   - Envie `/start` para seu bot
   - Verifique se responde corretamente

3. **Configurar Webhook**
   O webhook será configurado automaticamente no primeiro start.

## 🔧 Configurações Adicionais

### **Descobrir seu Telegram ID**
1. Envie uma mensagem para @userinfobot
2. Copie seu ID
3. Adicione em `src/bot/commands/admin.ts`
4. Faça novo commit e push

### **Obter Credenciais Blofin**
1. Acesse https://www.blofin.com/
2. Vá em API Management  
3. Crie uma nova API Key
4. Anote: API Key, Secret Key, Passphrase
5. Configure no .env

### **Link do Grupo**
Seu grupo: https://t.me/c/2711959390/1
(O link será gerado automaticamente pelo bot)

## 📊 Monitoramento

Após o deploy, monitore:

- **Logs**: No Easypanel, veja logs em tempo real
- **Health**: `https://seu-dominio/health`
- **Métricas**: `https://seu-dominio/metrics`

## 🔍 Troubleshooting

### **Bot não responde**
1. Verifique logs no Easypanel
2. Teste health check
3. Verifique se webhook está configurado

### **Erro de database**
1. Verifique conexão PostgreSQL
2. Teste: `https://seu-dominio/health/database`

### **Erro de Redis**
1. Verifique conexão Redis  
2. Teste: `https://seu-dominio/health/redis`

### **API Blofin falha**
1. Verifique credenciais da API
2. Teste: `https://seu-dominio/health/blofin`

## ✅ Checklist Final

- [ ] Credenciais Blofin configuradas
- [ ] ID do admin adicionado
- [ ] Repositório GitHub criado
- [ ] Serviço criado no Easypanel
- [ ] Variáveis de ambiente configuradas
- [ ] Domínio configurado com SSL
- [ ] Deploy realizado com sucesso
- [ ] Health check passou
- [ ] Bot responde ao /start
- [ ] Comandos admin funcionam
- [ ] Verificação de afiliados testada

🎉 **Parabéns! Seu bot está no ar!**