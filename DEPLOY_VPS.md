# 🚀 Deploy no VPS - Guia Completo

Este guia mostra como fazer deploy do bot Telegram no seu VPS e configurar webhook para testes.

## 📋 Pré-requisitos

### No VPS:
- Ubuntu 20.04+ ou similar
- Node.js 18+ 
- PostgreSQL 12+
- Redis 6+
- Nginx (para proxy reverso)
- Domínio apontando para o VPS
- Certificado SSL (Let's Encrypt)

## 🔧 Configuração Inicial do VPS

### 1. Conectar ao VPS e atualizar sistema:
```bash
ssh root@seu-vps-ip
apt update && apt upgrade -y
```

### 2. Instalar dependências:
```bash
# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# PostgreSQL
apt install -y postgresql postgresql-contrib

# Redis
apt install -y redis-server

# Nginx
apt install -y nginx

# Certbot para SSL
apt install -y certbot python3-certbot-nginx

# PM2 para gerenciar processos Node.js
npm install -g pm2

# Git
apt install -y git
```

## 🗄️ Configuração do Banco de Dados

### PostgreSQL:
```bash
# Acessar PostgreSQL
sudo -u postgres psql

# Criar banco e usuário
CREATE DATABASE telegram_bot;
CREATE USER bot_user WITH ENCRYPTED PASSWORD 'sua_senha_forte';
GRANT ALL PRIVILEGES ON DATABASE telegram_bot TO bot_user;
\q
```

### Redis:
```bash
# Editar configuração do Redis
nano /etc/redis/redis.conf

# Adicionar senha (descomente e altere):
# requirepass sua_senha_redis

# Reiniciar Redis
systemctl restart redis-server
systemctl enable redis-server
```

## 🌐 Configuração do Domínio e SSL

### 1. Configurar DNS:
Aponte seu domínio (ex: `botcrypto.seudominio.com`) para o IP do VPS.

### 2. Configurar Nginx:
```bash
# Criar configuração do site
nano /etc/nginx/sites-available/telegram-bot

# Adicionar conteúdo:
server {
    listen 80;
    server_name botcrypto.seudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Ativar site
ln -s /etc/nginx/sites-available/telegram-bot /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 3. Configurar SSL com Let's Encrypt:
```bash
certbot --nginx -d botcrypto.seudominio.com
```

## 📦 Deploy da Aplicação

### 1. Clonar repositório:
```bash
# Navegar para diretório de aplicações
cd /var/www

# Clonar repositório (substitua pela sua URL)
git clone https://github.com/seurepo/bot-telegram.git
cd bot-telegram

# Instalar dependências
npm install --production
```

### 2. Configurar variáveis de ambiente:
```bash
# Criar arquivo .env
nano .env
```

Adicione as seguintes variáveis:
```env
# Telegram
TELEGRAM_BOT_TOKEN=SEU_BOT_TOKEN_AQUI
TELEGRAM_GROUP_ID=-1001234567890
TELEGRAM_WEBHOOK_URL=https://botcrypto.seudominio.com/webhook

# Blofin API
BLOFIN_API_KEY=sua_api_key_aqui
BLOFIN_SECRET_KEY=sua_secret_key_aqui
BLOFIN_PASSPHRASE=sua_passphrase_aqui
BLOFIN_BASE_URL=https://openapi.blofin.com
YOUR_REFERRAL_CODE=GoEEO9

# Database
DATABASE_URL=postgresql://bot_user:sua_senha_forte@localhost:5432/telegram_bot

# Redis
REDIS_URL=redis://:sua_senha_redis@localhost:6379

# App Config
NODE_ENV=production
PORT=3000
JWT_SECRET=seu_jwt_secret_32_chars_minimo
ENCRYPTION_KEY=sua_chave_encriptacao_32_chars

# Logs
LOG_LEVEL=2
LOG_DIR=/var/www/bot-telegram/logs

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Bot Config
VERIFICATION_TIMEOUT_HOURS=24
MAX_VERIFICATION_ATTEMPTS=3
```

### 3. Compilar TypeScript:
```bash
npm run build
```

### 4. Configurar PM2:
```bash
# Criar arquivo de configuração PM2
nano ecosystem.config.js
```

Adicione:
```javascript
module.exports = {
  apps: [{
    name: 'telegram-crypto-bot',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
```

### 5. Iniciar aplicação:
```bash
# Criar diretório de logs
mkdir -p logs

# Iniciar com PM2
pm2 start ecosystem.config.js

# Salvar configuração PM2
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup
```

## 🔧 Configuração das Permissões

```bash
# Alterar proprietário dos arquivos
chown -R www-data:www-data /var/www/bot-telegram

# Definir permissões
chmod -R 755 /var/www/bot-telegram
chmod -R 777 /var/www/bot-telegram/logs
```

## 🤖 Configuração do Bot no Telegram

### 1. Criar Bot:
- Fale com @BotFather no Telegram
- Use `/newbot` e siga as instruções
- Copie o token gerado

### 2. Configurar Webhook:
```bash
# Testar se a aplicação está rodando
curl https://botcrypto.seudominio.com/health

# Configurar webhook (substitua o token)
curl -X POST "https://api.telegram.org/botSEU_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://botcrypto.seudominio.com/webhook"}'
```

### 3. Obter ID do grupo:
```bash
# Adicione o bot ao grupo e envie uma mensagem
# Depois execute:
curl "https://api.telegram.org/botSEU_BOT_TOKEN/getUpdates"

# Procure por "chat":{"id":-1001234567890 na resposta
```

## 📊 Monitoramento e Logs

### Comandos úteis:
```bash
# Status da aplicação
pm2 status

# Ver logs em tempo real
pm2 logs telegram-crypto-bot

# Ver logs da aplicação
tail -f /var/www/bot-telegram/logs/app.log

# Ver apenas erros
tail -f /var/www/bot-telegram/logs/error.log

# Reiniciar aplicação
pm2 restart telegram-crypto-bot

# Parar aplicação
pm2 stop telegram-crypto-bot
```

### Endpoints de monitoramento:
- `https://botcrypto.seudominio.com/health` - Status geral
- `https://botcrypto.seudominio.com/health/database` - Status PostgreSQL
- `https://botcrypto.seudominio.com/health/redis` - Status Redis
- `https://botcrypto.seudominio.com/health/blofin` - Status API Blofin
- `https://botcrypto.seudominio.com/metrics` - Métricas do sistema

## 🧪 Testes

### 1. Testar conexões:
```bash
# Testar aplicação
curl https://botcrypto.seudominio.com/

# Testar saúde dos serviços
curl https://botcrypto.seudominio.com/health

# Testar webhook
curl -X POST https://botcrypto.seudominio.com/webhook \
     -H "Content-Type: application/json" \
     -d '{"message": {"text": "test"}}'
```

### 2. Testar bot:
- Envie `/start` para o bot
- Verifique se recebe resposta
- Teste comandos: `/help`, `/status`

### 3. Testar API Blofin:
```bash
# Executar teste da API
cd /var/www/bot-telegram
node test-api-simple.js
```

## 🚨 Troubleshooting

### Problemas comuns:

#### Bot não responde:
```bash
# Verificar logs
tail -20 /var/www/bot-telegram/logs/error.log

# Verificar webhook
curl "https://api.telegram.org/botSEU_BOT_TOKEN/getWebhookInfo"

# Reiniciar aplicação
pm2 restart telegram-crypto-bot
```

#### Erro de conexão com banco:
```bash
# Testar conexão PostgreSQL
psql -h localhost -U bot_user -d telegram_bot

# Verificar status do serviço
systemctl status postgresql
```

#### Erro na API Blofin:
```bash
# Ver logs específicos da Blofin
grep "BLOFIN_" /var/www/bot-telegram/logs/error.log | tail -10

# Testar credenciais
cd /var/www/bot-telegram
node test-api-simple.js
```

## 🔄 Atualizações

### Para atualizar o bot:
```bash
cd /var/www/bot-telegram

# Fazer backup do .env
cp .env .env.backup

# Puxar atualizações
git pull origin main

# Reinstalar dependências se necessário
npm install --production

# Recompilar
npm run build

# Reiniciar
pm2 restart telegram-crypto-bot
```

## 🔐 Segurança

### Configurações importantes:
```bash
# Firewall básico
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable

# Configurar fail2ban (opcional)
apt install fail2ban

# Backup automático do banco (crontab)
crontab -e
# Adicionar: 0 2 * * * pg_dump telegram_bot > /backup/telegram_bot_$(date +\%Y\%m\%d).sql
```

## ✅ Checklist Final

- [ ] VPS configurado com todas as dependências
- [ ] Domínio apontando para o VPS
- [ ] SSL configurado corretamente
- [ ] PostgreSQL e Redis configurados
- [ ] Aplicação compilada e rodando
- [ ] PM2 configurado para auto-restart
- [ ] Webhook do Telegram configurado
- [ ] Logs funcionando corretamente
- [ ] Endpoints de saúde respondendo
- [ ] Bot respondendo a comandos
- [ ] API Blofin funcionando

Depois de completar todos os passos, seu bot estará rodando em produção no endereço `https://botcrypto.seudominio.com`!