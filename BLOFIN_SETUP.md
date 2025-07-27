# 🏦 Configuração da API Blofin

## 🔑 Como Obter as Credenciais da API

### 1. **Acesse sua Conta Blofin**
- Vá para: https://www.blofin.com/
- Faça login na sua conta

### 2. **Acesse API Management**
- No menu, procure por "API Management" ou "API Keys"
- Clique para acessar o gerenciamento de APIs

### 3. **Criar Nova API Key**
- Clique em "Create API Key" ou "Nova Chave API"
- Configure as permissões necessárias:
  - ✅ **Read** (para verificar afiliados)
  - ❌ Trade (não necessário)
  - ❌ Withdraw (não necessário)

### 4. **Anotar Credenciais**
Você receberá 3 informações importantes:

```
API Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Secret Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Passphrase: sua_passphrase_escolhida
```

### 5. **Configurar no .env**
Substitua no arquivo `.env`:

```bash
BLOFIN_API_KEY=sua_api_key_aqui
BLOFIN_SECRET_KEY=sua_secret_key_aqui
BLOFIN_PASSPHRASE=sua_passphrase_aqui
```

## 🔗 Configurar Link de Afiliado

### 1. **Acessar Programa de Afiliados**
- No painel Blofin, vá para "Affiliate Program"
- Ou acesse: https://www.blofin.com/affiliate

### 2. **Obter Código de Referência**
- Procure por "Referral Code" ou "Código de Indicação"
- Copie seu código (geralmente formato: ABC123 ou similar)

### 3. **Configurar no .env**
```bash
YOUR_REFERRAL_CODE=seu_codigo_de_referencia
```

## 🧪 Testar Configuração

### 1. **Verificar API**
Após configurar, teste se a API está funcionando:

```bash
# Execute o bot localmente
npm run dev

# Ou teste o endpoint de saúde
curl https://seu-dominio/health/blofin
```

### 2. **Testar Link de Afiliado**
O bot gerará automaticamente links no formato:
```
https://www.blofin.com/register?ref=SEU_CODIGO&source=telegram_USER_ID
```

## ⚠️ Importantes Configurações de Segurança

### 1. **Permissões da API**
- ✅ Use apenas permissões necessárias (Read)
- ❌ Nunca dê permissões de Trade ou Withdraw
- 🔒 Mantenha as credenciais seguras

### 2. **IP Whitelist (Opcional)**
- Configure IP whitelist se disponível
- Adicione o IP do seu servidor Easypanel

### 3. **Backup das Credenciais**
- Salve as credenciais em local seguro
- Nunca commit no Git
- Use variáveis de ambiente sempre

## 🔍 Verificação de Afiliados

O bot verifica automaticamente se usuários se cadastraram via seu link:

### **Como Funciona**
1. Usuário clica no seu link de afiliado
2. Se cadastra na Blofin
3. Executa `/register` no bot
4. Bot consulta API Blofin para verificar
5. Se encontrado, libera acesso ao grupo

### **Endpoint Usado**
```
GET /api/v1/affiliate/invitees
```

### **Dados Verificados**
- Email do usuário
- UID da Blofin
- Data de cadastro (últimas 24h)
- Nível de verificação

## 📊 Monitoramento

### **Logs da API**
O bot registra todas as chamadas à API:
```
✅ Blofin API - User verified: user@email.com
❌ Blofin API - User not found: telegram_123456
🔄 Blofin API - Health check: OK
```

### **Métricas**
Acesse `/metrics` para ver:
- Taxa de verificação de usuários
- Chamadas à API por período
- Erros de API

## 🆘 Troubleshooting

### **Erro: "Invalid API Key"**
- Verifique se a API Key está correta
- Confirme se a API está ativa na Blofin

### **Erro: "Invalid Signature"**
- Verifique Secret Key e Passphrase
- Confirme formato das credenciais

### **Erro: "Permission Denied"**
- Verifique permissões da API Key
- Certifique-se que Read está habilitado

### **Usuário não é encontrado**
- Verifique se usou seu link de afiliado
- Confirme se cadastro foi nas últimas 24h
- Teste com email ou UID diretamente

## 📋 Checklist Final

- [ ] Conta Blofin criada
- [ ] API Key gerada com permissões corretas
- [ ] Credenciais anotadas com segurança
- [ ] Código de afiliado obtido
- [ ] Variáveis configuradas no .env
- [ ] API testada e funcionando
- [ ] Link de afiliado funcionando
- [ ] Bot reconhece novos afiliados

🎉 **Configuração da Blofin completa!**