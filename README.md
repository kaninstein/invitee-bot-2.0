# 🤖 Telegram Crypto Bot - Blofin Affiliate

Bot do Telegram para controle de acesso a grupo de calls cripto baseado em afiliados da Blofin.

## 🎯 Funcionalidades

- ✅ Controle de acesso ao grupo baseado em verificação de afiliados
- 🔐 Sistema de autenticação e verificação automática
- 📊 Dashboard administrativo com estatísticas
- 🚀 Rate limiting e proteção anti-spam
- 💾 Cache Redis para performance
- 🔄 Tarefas agendadas para manutenção
- 📡 Webhooks para deploy em produção

## 🛠️ Stack Tecnológica

- **Node.js** + **TypeScript**
- **Telegraf.js** (Bot do Telegram)
- **PostgreSQL** (Banco de dados)
- **Redis** (Cache e sessões)
- **Express.js** (API e webhooks)
- **Docker** (Containerização)

## 🚀 Deploy no Easypanel

### Pré-requisitos

1. **PostgreSQL** configurado no Easypanel
2. **Redis** configurado no Easypanel
3. **Bot do Telegram** criado via @BotFather
4. **Conta Blofin** com API configurada

### Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```bash
# Telegram
TELEGRAM_BOT_TOKEN=6123456789:AAH...
TELEGRAM_GROUP_ID=-1001234567890
TELEGRAM_WEBHOOK_URL=https://your-bot-domain.easypanel.host/webhook

# Blofin API
BLOFIN_API_KEY=your_api_key
BLOFIN_SECRET_KEY=your_secret
BLOFIN_PASSPHRASE=your_passphrase
BLOFIN_BASE_URL=https://openapi.blofin.com
YOUR_REFERRAL_CODE=your_referral_code

# Database (usar nomes dos serviços no Easypanel)
DATABASE_URL=postgresql://username:password@postgres-service:5432/telegram_bot

# Redis (usar nome do serviço no Easypanel)
REDIS_URL=redis://redis-service:6379

# App Config
NODE_ENV=production
PORT=3000
JWT_SECRET=your_super_secret_jwt_key
ENCRYPTION_KEY=your_32_char_encryption_key
```

### Passos do Deploy

1. **Criar repositório** no GitHub com o código
2. **No Easypanel**, criar novo serviço tipo "App"
3. **Conectar ao repositório** GitHub
4. **Configurar variáveis** de ambiente
5. **Deploy** automático

## 📋 Comandos do Bot

### Usuários
- `/start` - Tela inicial e instruções
- `/register` - Verificar cadastro na Blofin
- `/status` - Ver status da conta
- `/help` - Ajuda e suporte

### Administradores
- `/stats` - Estatísticas do bot
- `/listusers` - Listar usuários com acesso
- `/revokeaccess <telegram_id>` - Revogar acesso
- `/broadcast <mensagem>` - Transmitir mensagem

## 🔧 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Compilar TypeScript
npm run build

# Executar em desenvolvimento
npm run dev

# Executar em produção
npm start
```

## 📊 Monitoramento

### Endpoints de Saúde

- `GET /health` - Status geral dos serviços
- `GET /health/database` - Status do PostgreSQL
- `GET /health/redis` - Status do Redis
- `GET /health/blofin` - Status da API Blofin
- `GET /metrics` - Métricas do sistema

### Logs

O bot gera logs estruturados para monitoramento:

```
📝 Incoming request: { user_id, command, timestamp }
✅ Request completed in Xms
📊 User verified successfully: telegram_id
🧹 Cleaned up X expired sessions
```

## 🔐 Segurança

- ✅ Rate limiting por usuário
- ✅ Validação de entrada
- ✅ Sanitização de dados
- ✅ Criptografia de tokens
- ✅ Logs de auditoria
- ✅ Middleware de segurança

## 📝 Estrutura do Projeto

```
src/
├── bot/
│   ├── commands/          # Comandos do bot
│   ├── handlers/          # Handlers de eventos
│   └── bot.ts            # Configuração principal
├── config/
│   ├── database.ts       # Config PostgreSQL
│   ├── redis.ts          # Config Redis
│   └── index.ts          # Config geral
├── middleware/
│   ├── auth.ts           # Autenticação
│   ├── rateLimit.ts      # Rate limiting
│   └── error.ts          # Tratamento de erros
├── services/
│   ├── blofinService.ts  # API Blofin
│   └── userService.ts    # Gestão de usuários
├── routes/
│   └── health.ts         # Health checks
├── utils/
│   └── scheduler.ts      # Tarefas agendadas
├── types/
│   └── index.ts          # Tipos TypeScript
└── index.ts              # Entry point
```

## 🤝 Como Funciona

1. **Usuário executa** `/start`
2. **Bot gera** link personalizado da Blofin
3. **Usuário se cadastra** na Blofin
4. **Usuário executa** `/register`
5. **Bot verifica** na API da Blofin
6. **Se verificado**, usuário ganha acesso ao grupo
7. **Bot monitora** entrada no grupo
8. **Remove** usuários não autorizados

## 📞 Suporte

Para problemas técnicos:
1. Verifique os logs do container
2. Teste endpoints de saúde
3. Verifique variáveis de ambiente
4. Monitore métricas do sistema

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

**⚠️ Importante**: Este bot é para uso educacional e deve ser usado respeitando os termos de serviço do Telegram e da Blofin.