#!/bin/bash

# Script de configuração automática do VPS para o Bot Telegram
# Execute como: bash vps-setup.sh

set -e

echo "🚀 Iniciando configuração do VPS para Bot Telegram..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Verificar se está executando como root
if [ "$EUID" -ne 0 ]; then
    error "Execute este script como root: sudo bash vps-setup.sh"
fi

# Variáveis configuráveis
DOMAIN=""
DB_PASSWORD=""
REDIS_PASSWORD=""
APP_USER="telegram-bot"
APP_DIR="/var/www/bot-telegram"

# Solicitar informações do usuário
read -p "🌐 Digite seu domínio (ex: botcrypto.seudominio.com): " DOMAIN
read -s -p "🔐 Digite uma senha forte para PostgreSQL: " DB_PASSWORD
echo
read -s -p "🔐 Digite uma senha forte para Redis: " REDIS_PASSWORD
echo

if [ -z "$DOMAIN" ] || [ -z "$DB_PASSWORD" ] || [ -z "$REDIS_PASSWORD" ]; then
    error "Todas as informações são obrigatórias!"
fi

log "📋 Configurações:"
log "   Domínio: $DOMAIN"
log "   Diretório da aplicação: $APP_DIR"
log "   Usuário da aplicação: $APP_USER"

# 1. Atualizar sistema
log "📦 Atualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar dependências básicas
log "🔧 Instalando dependências básicas..."
apt install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates

# 3. Instalar Node.js 18
log "📦 Instalando Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verificar instalação do Node.js
node_version=$(node --version)
npm_version=$(npm --version)
log "✅ Node.js instalado: $node_version"
log "✅ NPM instalado: $npm_version"

# 4. Instalar PostgreSQL
log "🗄️  Instalando PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Configurar PostgreSQL
log "🔧 Configurando PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Criar banco e usuário
sudo -u postgres psql <<EOF
CREATE DATABASE telegram_bot;
CREATE USER bot_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE telegram_bot TO bot_user;
ALTER USER bot_user CREATEDB;
\q
EOF

log "✅ PostgreSQL configurado com banco 'telegram_bot'"

# 5. Instalar Redis
log "📦 Instalando Redis..."
apt install -y redis-server

# Configurar Redis
log "🔧 Configurando Redis..."
sed -i "s/# requirepass foobared/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

log "✅ Redis configurado com senha"

# 6. Instalar Nginx
log "🌐 Instalando Nginx..."
apt install -y nginx

# 7. Instalar Certbot
log "🔒 Instalando Certbot..."
apt install -y certbot python3-certbot-nginx

# 8. Instalar PM2
log "🔄 Instalando PM2..."
npm install -g pm2

# 9. Criar usuário para aplicação
log "👤 Criando usuário da aplicação..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash $APP_USER
    usermod -aG www-data $APP_USER
    log "✅ Usuário $APP_USER criado"
else
    log "✅ Usuário $APP_USER já existe"
fi

# 10. Criar estrutura de diretórios
log "📁 Criando estrutura de diretórios..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/logs
mkdir -p /backup/telegram-bot

# 11. Configurar Nginx
log "🌐 Configurando Nginx..."
cat > /etc/nginx/sites-available/telegram-bot <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Logs
    access_log /var/log/nginx/telegram-bot.access.log;
    error_log /var/log/nginx/telegram-bot.error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Webhook endpoint
    location /webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Rate limiting
        limit_req zone=webhook burst=10 nodelay;
    }

    # Health checks
    location /health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Metrics (opcional - remover em produção)
    location /metrics {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Restringir acesso (opcional)
        # allow 127.0.0.1;
        # deny all;
    }

    # Logs endpoint (remover em produção)
    location /logs {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Restringir acesso (recomendado)
        # allow 127.0.0.1;
        # deny all;
    }

    # Root endpoint
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Block access to sensitive files
    location ~ /\\.env {
        deny all;
        return 404;
    }

    location ~ /logs/ {
        deny all;
        return 404;
    }
}

# Rate limiting
http {
    limit_req_zone \$binary_remote_addr zone=webhook:10m rate=1r/s;
}
EOF

# Remover configuração padrão e ativar nova
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/telegram-bot /etc/nginx/sites-enabled/

# Testar configuração do Nginx
nginx -t
systemctl reload nginx

log "✅ Nginx configurado para domínio $DOMAIN"

# 12. Configurar firewall básico
log "🔥 Configurando firewall..."
ufw --force enable
ufw allow ssh
ufw allow 80
ufw allow 443

log "✅ Firewall configurado"

# 13. Criar script de deploy
log "📝 Criando script de deploy..."
cat > $APP_DIR/deploy.sh <<EOF
#!/bin/bash

# Script de deploy do Bot Telegram
set -e

echo "🚀 Iniciando deploy..."

# Navegar para diretório da aplicação
cd $APP_DIR

# Fazer backup do .env se existir
if [ -f .env ]; then
    cp .env .env.backup.\$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup do .env criado"
fi

# Puxar atualizações do Git (se for repositório Git)
if [ -d .git ]; then
    git pull origin main
    echo "✅ Código atualizado do Git"
fi

# Instalar/atualizar dependências
npm install --production

# Compilar TypeScript
npm run build

# Parar aplicação se estiver rodando
pm2 stop telegram-crypto-bot 2>/dev/null || true

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração PM2
pm2 save

echo "🎉 Deploy concluído com sucesso!"
EOF

chmod +x $APP_DIR/deploy.sh

# 14. Criar arquivo de configuração do PM2
log "🔄 Criando configuração do PM2..."
cat > $APP_DIR/ecosystem.config.js <<EOF
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
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm Z'
  }]
};
EOF

# 15. Criar template do .env
log "📝 Criando template de configuração..."
cat > $APP_DIR/.env.template <<EOF
# Telegram
TELEGRAM_BOT_TOKEN=SEU_BOT_TOKEN_AQUI
TELEGRAM_GROUP_ID=-1001234567890
TELEGRAM_WEBHOOK_URL=https://$DOMAIN/webhook

# Blofin API
BLOFIN_API_KEY=sua_api_key_aqui
BLOFIN_SECRET_KEY=sua_secret_key_aqui
BLOFIN_PASSPHRASE=sua_passphrase_aqui
BLOFIN_BASE_URL=https://openapi.blofin.com
YOUR_REFERRAL_CODE=GoEEO9

# Database
DATABASE_URL=postgresql://bot_user:$DB_PASSWORD@localhost:5432/telegram_bot

# Redis
REDIS_URL=redis://:$REDIS_PASSWORD@localhost:6379

# App Config
NODE_ENV=production
PORT=3000
JWT_SECRET=GERE_UMA_CHAVE_ALEATORIA_32_CHARS
ENCRYPTION_KEY=GERE_UMA_CHAVE_ALEATORIA_32_CHARS

# Logs
LOG_LEVEL=2
LOG_DIR=$APP_DIR/logs

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Bot Config
VERIFICATION_TIMEOUT_HOURS=24
MAX_VERIFICATION_ATTEMPTS=3
EOF

# 16. Configurar permissões
log "🔐 Configurando permissões..."
chown -R $APP_USER:www-data $APP_DIR
chmod -R 755 $APP_DIR
chmod -R 777 $APP_DIR/logs

# 17. Configurar PM2 para iniciar no boot
log "🔄 Configurando PM2 para iniciar no boot..."
sudo -u $APP_USER pm2 startup systemd -u $APP_USER --hp /home/$APP_USER

# 18. Criar script de backup
log "💾 Criando script de backup..."
cat > /usr/local/bin/backup-telegram-bot.sh <<EOF
#!/bin/bash

# Script de backup do Bot Telegram
BACKUP_DIR="/backup/telegram-bot"
DATE=\$(date +%Y%m%d_%H%M%S)

# Criar diretório de backup
mkdir -p \$BACKUP_DIR

# Backup do banco de dados
pg_dump -h localhost -U bot_user telegram_bot > "\$BACKUP_DIR/database_\$DATE.sql"

# Backup dos logs
tar -czf "\$BACKUP_DIR/logs_\$DATE.tar.gz" -C $APP_DIR logs/

# Backup da configuração
cp $APP_DIR/.env "\$BACKUP_DIR/env_\$DATE.backup" 2>/dev/null || true

# Limpar backups antigos (manter apenas últimos 7 dias)
find \$BACKUP_DIR -name "*.sql" -mtime +7 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find \$BACKUP_DIR -name "*.backup" -mtime +7 -delete

echo "✅ Backup concluído: \$DATE"
EOF

chmod +x /usr/local/bin/backup-telegram-bot.sh

# Adicionar backup ao crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-telegram-bot.sh") | crontab -

log "✅ Script de backup configurado (executa diariamente às 2h)"

# 19. Criar script de logs
log "📊 Criando utilitários de monitoramento..."
cat > /usr/local/bin/bot-logs.sh <<EOF
#!/bin/bash

# Utilitário para visualizar logs do Bot Telegram

case "\$1" in
    "app")
        tail -f $APP_DIR/logs/app.log
        ;;
    "error")
        tail -f $APP_DIR/logs/error.log
        ;;
    "pm2")
        pm2 logs telegram-crypto-bot
        ;;
    "nginx")
        tail -f /var/log/nginx/telegram-bot.access.log
        ;;
    "status")
        echo "🤖 Status da aplicação:"
        pm2 status telegram-crypto-bot
        echo ""
        echo "🗄️  Status PostgreSQL:"
        systemctl status postgresql --no-pager -l
        echo ""
        echo "📦 Status Redis:"
        systemctl status redis-server --no-pager -l
        echo ""
        echo "🌐 Status Nginx:"
        systemctl status nginx --no-pager -l
        ;;
    *)
        echo "Uso: bot-logs.sh [app|error|pm2|nginx|status]"
        echo ""
        echo "Comandos disponíveis:"
        echo "  app    - Ver logs da aplicação em tempo real"
        echo "  error  - Ver logs de erro em tempo real"
        echo "  pm2    - Ver logs do PM2"
        echo "  nginx  - Ver logs do Nginx"
        echo "  status - Ver status de todos os serviços"
        ;;
esac
EOF

chmod +x /usr/local/bin/bot-logs.sh

# 20. Finalização
log "🎉 Configuração do VPS concluída!"

echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1. 📁 Fazer upload do código da aplicação para: $APP_DIR"
echo "   Exemplo: scp -r ./bot-telegram/* root@$DOMAIN:$APP_DIR/"
echo ""
echo "2. 📝 Configurar variáveis de ambiente:"
echo "   cd $APP_DIR"
echo "   cp .env.template .env"
echo "   nano .env"
echo ""
echo "3. 🔒 Configurar SSL:"
echo "   certbot --nginx -d $DOMAIN"
echo ""
echo "4. 🚀 Fazer primeiro deploy:"
echo "   cd $APP_DIR"
echo "   ./deploy.sh"
echo ""
echo "5. 🤖 Configurar webhook do Telegram:"
echo "   curl -X POST \"https://api.telegram.org/botSEU_BOT_TOKEN/setWebhook\" \\"
echo "        -H \"Content-Type: application/json\" \\"
echo "        -d '{\"url\": \"https://$DOMAIN/webhook\"}'"
echo ""
echo "📊 COMANDOS ÚTEIS:"
echo "  bot-logs.sh status  - Ver status dos serviços"
echo "  bot-logs.sh app     - Ver logs da aplicação"
echo "  bot-logs.sh error   - Ver logs de erro"
echo ""
echo "🌐 ENDPOINTS:"
echo "  https://$DOMAIN/health - Status da aplicação"
echo "  https://$DOMAIN/metrics - Métricas do sistema"
echo ""
echo "✅ VPS configurado com sucesso!"
EOF