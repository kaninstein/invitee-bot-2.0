# 🚀 Configuração Automática para Easypanel

Este bot foi configurado para funcionar automaticamente no Easypanel com PostgreSQL e Redis pré-configurados.

## 📋 Pré-requisitos no Easypanel

### 1. Criar PostgreSQL
- **Nome do serviço**: `postgres`
- **Usuário**: `postgres` 
- **Senha**: `postgres`
- **Database**: `invitee_bot`
- **Porta**: `5432`

### 2. Criar Redis
- **Nome do serviço**: `redis`
- **Senha**: `redis`
- **Porta**: `6379`

### 3. Criar Aplicação
- **Nome**: `invitee-bot` (ou qualquer nome)
- **Repositório**: `git@github.com:kaninstein/invitee-bot-2.0.git`
- **Branch**: `main`
- **Port**: `3000`
- **Dockerfile**: ✅ (já incluído)

## ⚙️ Variáveis de Ambiente Obrigatórias

Configure apenas estas variáveis no Easypanel (Variables):

```bash
# Telegram (obrigatório)
TELEGRAM_BOT_TOKEN=seu_token_do_botfather
TELEGRAM_GROUP_ID=-100123456789
TELEGRAM_WEBHOOK_URL=https://sua-app.easypanel.host/webhook

# Blofin API (obrigatório)
BLOFIN_API_KEY=sua_api_key
BLOFIN_SECRET_KEY=sua_secret_key  
BLOFIN_PASSPHRASE=sua_passphrase
YOUR_REFERRAL_CODE=seu_codigo_afiliado
```

## 🎥 Variável Opcional - Tutorial em Vídeo

Se você quiser personalizar o link do tutorial em vídeo para encontrar o UID:

```bash
# Tutorial UID (opcional)
LOOM_TUTORIAL_URL=https://www.loom.com/share/seu-link-personalizado
```

**Padrão**: https://www.loom.com/share/your-uid-tutorial

## ✅ O que já está configurado automaticamente

- ✅ **PostgreSQL**: Conexão automática com postgres:postgres@postgres:5432
- ✅ **Redis**: Conexão automática com redis:redis@redis:6379
- ✅ **Migrations**: Executam automaticamente na inicialização
- ✅ **Health Checks**: Configurados para todos os serviços
- ✅ **Multi-idioma**: Português (padrão) e Inglês
- ✅ **Rate Limiting**: Pré-configurado
- ✅ **Logs**: Estruturados e organizados
- ✅ **Dockerfile**: Otimizado para produção
- ✅ **Security**: JWT, encryption, validações

## 🚀 Deploy Simples

1. **Crie os serviços** PostgreSQL e Redis no Easypanel
2. **Clone este repositório** como nova aplicação
3. **Configure as 7 variáveis** acima
4. **Deploy!** 

O bot iniciará automaticamente e mostrará no log se alguma configuração está pendente.

## 🔍 Verificação

Acesse os endpoints para verificar:

- **Health**: `https://sua-app.easypanel.host/health`
- **Status**: `https://sua-app.easypanel.host/alive`
- **Metrics**: `https://sua-app.easypanel.host/metrics`

## 📝 Logs

O bot mostra claramente no startup se alguma configuração está pendente:

```
⚠️  CONFIGURAÇÃO PENDENTE - Configure as seguintes variáveis:
   ❌ TELEGRAM.BOTTOKEN
   ❌ BLOFIN.APIKEY
   ...
🚀 PostgreSQL e Redis já estão pré-configurados para Easypanel!
```

## 🆘 Suporte

Se tiver problemas:

1. Verifique os logs do container
2. Confirme que PostgreSQL e Redis estão rodando
3. Verifique se as 7 variáveis obrigatórias estão configuradas
4. Teste os endpoints de health

O sistema foi projetado para ser **zero-configuration** para infraestrutura e **minimal-configuration** para APIs externas!