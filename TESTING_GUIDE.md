# 🧪 Guia de Testes - Bot Telegram

Este guia detalha como testar todas as funcionalidades do bot após o deploy.

## 🚀 Deploy Rápido (Opção Fácil)

### Pré-requisitos:
- VPS com Ubuntu 20.04+
- Domínio apontando para o VPS
- Bot criado no @BotFather
- Credenciais da API Blofin

### Comando único para deploy:
```bash
# 1. Configurar VPS (executar no VPS)
wget https://raw.githubusercontent.com/seurepo/bot-telegram/main/scripts/vps-setup.sh
sudo bash vps-setup.sh

# 2. Deploy da aplicação (executar localmente)
bash scripts/quick-deploy.sh
```

## 🔧 Configuração Manual Passo a Passo

### 1. Preparar VPS:
```bash
# Conectar ao VPS
ssh root@seu-vps-ip

# Executar script de configuração
bash vps-setup.sh
```

### 2. Configurar SSL:
```bash
# No VPS, configurar certificado SSL
certbot --nginx -d seudominio.com
```

### 3. Upload do código:
```bash
# Local: fazer upload do código
scp -r ./bot-telegram/* root@seudominio.com:/var/www/bot-telegram/

# VPS: configurar e iniciar
cd /var/www/bot-telegram
./deploy.sh
```

## ✅ Checklist de Testes

### 🔌 1. Testes de Conectividade

#### Teste básico da aplicação:
```bash
# Testar se aplicação está respondendo
curl https://seudominio.com/

# Resposta esperada:
{
  "name": "Telegram Crypto Bot",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2024-01-26T14:00:00.000Z"
}
```

#### Teste de saúde dos serviços:
```bash
# Testar health checks
curl https://seudominio.com/health

# Resposta esperada:
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected", 
    "blofin": "connected"
  }
}
```

### 🤖 2. Testes do Bot Telegram

#### Configurar webhook:
```bash
# Configurar webhook do Telegram
curl -X POST "https://api.telegram.org/botSEU_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://seudominio.com/webhook"}'

# Verificar webhook
curl "https://api.telegram.org/botSEU_BOT_TOKEN/getWebhookInfo"
```

#### Testes básicos do bot:

**1. Comando /start:**
- Envie `/start` para o bot
- ✅ Deve receber mensagem de boas-vindas
- ✅ Deve receber link de cadastro da Blofin
- ✅ Deve ver instruções de verificação

**2. Comando /help:**
- Envie `/help`
- ✅ Deve receber lista de comandos
- ✅ Deve ver informações de suporte

**3. Comando /status:**
- Envie `/status`
- ✅ Deve mostrar status da sua conta
- ✅ Se não verificado: mensagem para se cadastrar

### 💰 3. Testes da API Blofin

#### Teste manual da API:
```bash
# No VPS, testar API Blofin
cd /var/www/bot-telegram
node test-api-simple.js
```

**Resultados esperados:**
- ✅ Endpoint público funcionando
- ✅ Autenticação bem-sucedida (código 200)
- ✅ Dados do afiliado retornados
- ❌ Se erro 152408: credenciais incorretas

#### Verificação de usuário:
1. Cadastre-se na Blofin usando o link do bot
2. Anote seu UID da Blofin
3. Envie `/register` ou seu UID para o bot
4. ✅ Bot deve verificar e conceder acesso

### 🔐 4. Testes de Segurança

#### Rate limiting:
```bash
# Testar rate limiting (enviar muitas requisições)
for i in {1..20}; do
  curl -X POST https://seudominio.com/webhook \
       -H "Content-Type: application/json" \
       -d '{"message": {"text": "/start"}}' &
done
```

#### Endpoints protegidos:
```bash
# Tentar acessar arquivos sensíveis
curl https://seudominio.com/.env  # Deve retornar 404
curl https://seudominio.com/logs/ # Deve retornar 404
```

### 📊 5. Testes de Monitoramento

#### Verificar logs:
```bash
# No VPS, verificar logs
bot-logs.sh app      # Logs da aplicação
bot-logs.sh error    # Logs de erro
bot-logs.sh status   # Status dos serviços
```

#### Métricas:
```bash
# Testar endpoint de métricas
curl https://seudominio.com/metrics

# Resposta esperada:
{
  "uptime": 3600,
  "memory_usage": {...},
  "user_stats": {...}
}
```

## 🐛 Debugging e Troubleshooting

### Problemas Comuns:

#### Bot não responde:
```bash
# Verificar logs
tail -20 /var/www/bot-telegram/logs/error.log

# Verificar webhook
curl "https://api.telegram.org/botSEU_TOKEN/getWebhookInfo"

# Reiniciar bot
pm2 restart telegram-crypto-bot
```

#### Erro na API Blofin:
```bash
# Ver logs específicos da Blofin
grep "BLOFIN_" /var/www/bot-telegram/logs/error.log | tail -10

# Testar credenciais
cd /var/www/bot-telegram
node test-api-simple.js
```

#### Erro de banco de dados:
```bash
# Testar conexão PostgreSQL
psql -h localhost -U bot_user -d telegram_bot

# Verificar logs do PostgreSQL
sudo journalctl -u postgresql -f
```

#### Erro do Redis:
```bash
# Testar conexão Redis
redis-cli ping

# Verificar logs do Redis
sudo journalctl -u redis-server -f
```

### Comandos de Debug:

```bash
# Ver status completo
bot-logs.sh status

# Monitorar logs em tempo real
tail -f /var/www/bot-telegram/logs/app.log

# Ver últimos erros
tail -20 /var/www/bot-telegram/logs/error.log

# Buscar por usuário específico
grep "User: 123456" /var/www/bot-telegram/logs/app.log

# Ver requisições HTTP
grep "API_REQUEST" /var/www/bot-telegram/logs/app.log | tail -10

# Ver eventos do Telegram
grep "TELEGRAM_" /var/www/bot-telegram/logs/app.log | tail -10
```

## 📋 Cenários de Teste Completos

### Cenário 1: Usuário Novo
1. Usuário envia `/start`
2. Bot responde com link da Blofin
3. Usuário se cadastra na Blofin
4. Usuário volta e envia `/register` ou UID
5. Bot verifica na API Blofin
6. Bot concede acesso ao grupo
7. Usuário é adicionado ao grupo automaticamente

### Cenário 2: Usuário Existente
1. Usuário já verificado envia `/status`
2. Bot mostra informações da conta
3. Bot confirma acesso ao grupo

### Cenário 3: Usuário Não Verificado
1. Usuário não cadastrado tenta entrar no grupo
2. Bot remove usuário automaticamente
3. Bot envia mensagem explicativa

### Cenário 4: Administrador
1. Admin envia `/stats`
2. Bot mostra estatísticas do sistema
3. Admin pode usar comandos administrativos

## 🔄 Fluxo de Teste Automatizado

### Script de teste completo:
```bash
#!/bin/bash

# Script de teste automatizado
DOMAIN="seudominio.com"
BOT_TOKEN="seu_bot_token"

echo "🧪 Iniciando testes automatizados..."

# 1. Testar aplicação
echo "1. Testando aplicação..."
curl -f "https://$DOMAIN/" || echo "❌ Aplicação não responde"

# 2. Testar health
echo "2. Testando health checks..."
curl -f "https://$DOMAIN/health" || echo "❌ Health check falhou"

# 3. Testar webhook
echo "3. Testando webhook..."
curl -f "https://$DOMAIN/webhook" || echo "❌ Webhook não responde"

# 4. Verificar webhook do Telegram
echo "4. Verificando configuração do webhook..."
webhook_info=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo")
echo "$webhook_info" | grep -q "\"url\":\"https://$DOMAIN/webhook\"" || echo "❌ Webhook não configurado"

echo "✅ Testes automatizados concluídos"
```

## 📞 Suporte

### Em caso de problemas:

1. **Verificar logs primeiro:**
   ```bash
   bot-logs.sh error
   ```

2. **Verificar status dos serviços:**
   ```bash
   bot-logs.sh status
   ```

3. **Reiniciar aplicação:**
   ```bash
   pm2 restart telegram-crypto-bot
   ```

4. **Verificar configuração:**
   ```bash
   cat /var/www/bot-telegram/.env
   ```

5. **Testar conectividade:**
   ```bash
   curl -v https://seudominio.com/health
   ```

### Logs importantes para debugging:
- `/var/www/bot-telegram/logs/error.log` - Erros da aplicação
- `/var/log/nginx/telegram-bot.error.log` - Erros do Nginx
- `pm2 logs telegram-crypto-bot` - Logs do PM2
- `journalctl -u postgresql` - Logs do PostgreSQL
- `journalctl -u redis-server` - Logs do Redis

Com este guia, você consegue fazer deploy e testar completamente o bot Telegram no seu VPS!