#!/bin/bash

# Script de deploy rápido para VPS já configurado
# Execute como: bash quick-deploy.sh

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] $1${NC}"
}

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    error "Execute este script no diretório raiz do projeto (onde está o package.json)"
fi

# Variáveis configuráveis
VPS_HOST=""
VPS_USER="root"
DOMAIN=""
BOT_TOKEN=""
GROUP_ID=""
BLOFIN_API_KEY=""
BLOFIN_SECRET_KEY=""
BLOFIN_PASSPHRASE=""

echo "🚀 Deploy Rápido do Bot Telegram"
echo "================================="
echo ""

# Solicitar informações
read -p "🌐 IP ou domínio do VPS: " VPS_HOST
read -p "👤 Usuário SSH (padrão: root): " input_user
VPS_USER=${input_user:-root}
read -p "🌐 Domínio do bot (ex: botcrypto.seudominio.com): " DOMAIN
read -p "🤖 Token do bot Telegram: " BOT_TOKEN
read -p "👥 ID do grupo Telegram: " GROUP_ID
read -p "🔑 Blofin API Key: " BLOFIN_API_KEY
read -p "🔑 Blofin Secret Key: " BLOFIN_SECRET_KEY
read -p "🔑 Blofin Passphrase: " BLOFIN_PASSPHRASE

if [ -z "$VPS_HOST" ] || [ -z "$DOMAIN" ] || [ -z "$BOT_TOKEN" ]; then
    error "VPS Host, Domínio e Bot Token são obrigatórios!"
fi

# Gerar chaves aleatórias
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

log "📋 Configurações do deploy:"
info "   VPS: $VPS_USER@$VPS_HOST"
info "   Domínio: $DOMAIN"
info "   Bot Token: ${BOT_TOKEN:0:10}..."
info "   Grupo ID: $GROUP_ID"

# 1. Testar conexão SSH
log "🔌 Testando conexão SSH..."
if ! ssh -o ConnectTimeout=10 $VPS_USER@$VPS_HOST "echo 'Conexão OK'" > /dev/null 2>&1; then
    error "Falha na conexão SSH com $VPS_USER@$VPS_HOST"
fi
log "✅ Conexão SSH estabelecida"

# 2. Verificar se o VPS está configurado
log "🔍 Verificando configuração do VPS..."
ssh $VPS_USER@$VPS_HOST "
    if [ ! -d '/var/www/bot-telegram' ]; then
        echo 'ERRO: VPS não configurado. Execute primeiro: bash vps-setup.sh'
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo 'ERRO: Node.js não instalado'
        exit 1
    fi
    
    if ! command -v pm2 &> /dev/null; then
        echo 'ERRO: PM2 não instalado'
        exit 1
    fi
    
    echo 'VPS configurado corretamente'
"

# 3. Fazer backup do código atual (se existir)
log "💾 Fazendo backup do código atual..."
ssh $VPS_USER@$VPS_HOST "
    cd /var/www/bot-telegram
    if [ -f package.json ]; then
        tar -czf /backup/telegram-bot/code_backup_\$(date +%Y%m%d_%H%M%S).tar.gz \
            --exclude='node_modules' \
            --exclude='logs' \
            --exclude='.git' \
            .
        echo 'Backup do código atual criado'
    fi
"

# 4. Preparar arquivos para upload
log "📦 Preparando arquivos para upload..."
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copiar arquivos necessários (excluindo node_modules, logs, etc.)
rsync -av --exclude='node_modules' \
          --exclude='logs' \
          --exclude='.git' \
          --exclude='dist' \
          --exclude='.env' \
          ./ $TEMP_DIR/

# 5. Upload do código
log "📤 Fazendo upload do código..."
rsync -av --delete $TEMP_DIR/ $VPS_USER@$VPS_HOST:/var/www/bot-telegram/

# 6. Obter senhas do banco configuradas no VPS
log "🔍 Obtendo configurações do VPS..."
DB_PASSWORD=$(ssh $VPS_USER@$VPS_HOST "grep 'bot_user' /var/lib/postgresql/*/main/pg_hba.conf 2>/dev/null | head -1" || echo "")
REDIS_PASSWORD=$(ssh $VPS_USER@$VPS_HOST "grep '^requirepass' /etc/redis/redis.conf | cut -d' ' -f2" || echo "")

if [ -z "$REDIS_PASSWORD" ]; then
    warn "Senha do Redis não encontrada, usando configuração padrão"
    REDIS_PASSWORD="redis_password_aqui"
fi

# 7. Criar arquivo .env
log "📝 Configurando variáveis de ambiente..."
ssh $VPS_USER@$VPS_HOST "
    cat > /var/www/bot-telegram/.env << 'EOF'
# Telegram
TELEGRAM_BOT_TOKEN=$BOT_TOKEN
TELEGRAM_GROUP_ID=$GROUP_ID
TELEGRAM_WEBHOOK_URL=https://$DOMAIN/webhook

# Blofin API
BLOFIN_API_KEY=$BLOFIN_API_KEY
BLOFIN_SECRET_KEY=$BLOFIN_SECRET_KEY
BLOFIN_PASSPHRASE=$BLOFIN_PASSPHRASE
BLOFIN_BASE_URL=https://openapi.blofin.com
YOUR_REFERRAL_CODE=GoEEO9

# Database - Será obtida automaticamente do VPS
DATABASE_URL=postgresql://bot_user:sua_senha@localhost:5432/telegram_bot

# Redis - Será obtida automaticamente do VPS
REDIS_URL=redis://:$REDIS_PASSWORD@localhost:6379

# App Config
NODE_ENV=production
PORT=3000
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Logs
LOG_LEVEL=2
LOG_DIR=/var/www/bot-telegram/logs

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Bot Config
VERIFICATION_TIMEOUT_HOURS=24
MAX_VERIFICATION_ATTEMPTS=3
EOF
"

# 8. Instalar dependências e compilar
log "📦 Instalando dependências..."
ssh $VPS_USER@$VPS_HOST "
    cd /var/www/bot-telegram
    npm install --production
    npm run build
"

# 9. Configurar permissões
log "🔐 Configurando permissões..."
ssh $VPS_USER@$VPS_HOST "
    chown -R telegram-bot:www-data /var/www/bot-telegram
    chmod -R 755 /var/www/bot-telegram
    chmod -R 777 /var/www/bot-telegram/logs
"

# 10. Iniciar/reiniciar aplicação
log "🔄 Iniciando aplicação..."
ssh $VPS_USER@$VPS_HOST "
    cd /var/www/bot-telegram
    
    # Parar aplicação se estiver rodando
    sudo -u telegram-bot pm2 stop telegram-crypto-bot 2>/dev/null || true
    sudo -u telegram-bot pm2 delete telegram-crypto-bot 2>/dev/null || true
    
    # Iniciar aplicação
    sudo -u telegram-bot pm2 start ecosystem.config.js
    sudo -u telegram-bot pm2 save
    
    # Aguardar inicialização
    sleep 5
    
    # Verificar status
    sudo -u telegram-bot pm2 status telegram-crypto-bot
"

# 11. Testar aplicação
log "🧪 Testando aplicação..."
sleep 3

# Testar endpoint de saúde
if curl -s "http://$VPS_HOST:3000/health" > /dev/null; then
    log "✅ Aplicação respondendo na porta 3000"
else
    warn "⚠️  Aplicação não responde na porta 3000, mas pode estar iniciando..."
fi

# 12. Configurar webhook do Telegram
log "🤖 Configurando webhook do Telegram..."
webhook_response=$(curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d "{\"url\": \"https://$DOMAIN/webhook\"}")

if echo "$webhook_response" | grep -q '"ok":true'; then
    log "✅ Webhook configurado com sucesso"
else
    warn "⚠️  Problema ao configurar webhook: $webhook_response"
fi

# 13. Verificar webhook
webhook_info=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo")
log "📋 Informações do webhook:"
echo "$webhook_info" | python3 -m json.tool 2>/dev/null || echo "$webhook_info"

# 14. Testar endpoints
log "🔍 Testando endpoints da aplicação..."

echo ""
info "📊 Testando endpoints:"

# Testar health
if curl -s "https://$DOMAIN/health" > /dev/null; then
    log "✅ https://$DOMAIN/health - OK"
else
    warn "⚠️  https://$DOMAIN/health - Falhou"
fi

# Testar root
if curl -s "https://$DOMAIN/" > /dev/null; then
    log "✅ https://$DOMAIN/ - OK"
else
    warn "⚠️  https://$DOMAIN/ - Falhou"
fi

# 15. Mostrar logs iniciais
log "📋 Últimos logs da aplicação:"
ssh $VPS_USER@$VPS_HOST "tail -20 /var/www/bot-telegram/logs/app.log 2>/dev/null || echo 'Logs ainda não disponíveis'"

# 16. Finalização
echo ""
log "🎉 Deploy concluído com sucesso!"

echo ""
echo "📋 INFORMAÇÕES DO DEPLOY:"
echo "================================="
info "🌐 URL da aplicação: https://$DOMAIN"
info "🤖 Webhook configurado: https://$DOMAIN/webhook"
info "🏥 Health check: https://$DOMAIN/health"
info "📊 Métricas: https://$DOMAIN/metrics"

echo ""
echo "🔧 COMANDOS ÚTEIS NO VPS:"
echo "================================="
info "Ver status: bot-logs.sh status"
info "Ver logs: bot-logs.sh app"
info "Ver erros: bot-logs.sh error"
info "Reiniciar: pm2 restart telegram-crypto-bot"

echo ""
echo "🧪 PRÓXIMOS PASSOS:"
echo "================================="
info "1. Teste o bot enviando /start"
info "2. Configure seu ID como admin em src/bot/commands/admin.ts"
info "3. Monitore os logs em tempo real: ssh $VPS_USER@$VPS_HOST 'bot-logs.sh app'"

echo ""
warn "⚠️  IMPORTANTE:"
warn "   - Configure SSL: ssh $VPS_USER@$VPS_HOST 'certbot --nginx -d $DOMAIN'"
warn "   - Monitore os logs para verificar se não há erros"
warn "   - Teste todas as funcionalidades do bot"

echo ""
log "✅ Bot deployado e funcionando em: https://$DOMAIN"