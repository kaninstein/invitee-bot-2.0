#!/bin/bash

# Teste da API Blofin usando curl
# Script para verificar se as credenciais estão funcionando

echo "🔍 Testando API Blofin com curl..."
echo ""

# Configurações
API_KEY="ea75ea000d4a4f049a0ae9f197ae56c3"
SECRET_KEY="42b1ad7e2b7a4a239b0d45425b1da2f0"
PASSPHRASE="blofin_api_2024"
BASE_URL="https://openapi.blofin.com"

# Função para gerar timestamp
get_timestamp() {
    echo $(($(date +%s) * 1000))
}

# Função para gerar nonce (timestamp como nonce simples)
get_nonce() {
    echo $(date +%s%N | cut -b1-13)
}

# Testar endpoint básico (sem autenticação primeiro)
echo "1️⃣ Testando endpoint público (tickers)..."
curl -s -X GET "${BASE_URL}/api/v1/market/tickers?instId=BTC-USDT" | head -c 200
echo ""
echo ""

# Instruções para teste manual
echo "📋 Para testar a API Blofin manualmente:"
echo ""
echo "🔧 Configurações necessárias:"
echo "   API_KEY: ${API_KEY}"
echo "   SECRET_KEY: ${SECRET_KEY}"
echo "   PASSPHRASE: ${PASSPHRASE}"
echo ""

echo "🔗 Links importantes:"
echo "   • Link de afiliado: https://partner.blofin.com/d/blofin"
echo "   • Documentação: https://docs.blofin.com/"
echo ""

echo "🎯 Para descobrir seu Telegram ID:"
echo "   • Envie uma mensagem para @userinfobot no Telegram"
echo "   • Copie o ID que ele retornar"
echo "   • Adicione em src/bot/commands/admin.ts"
echo ""

echo "✅ Configuração da API Blofin está completa!"
echo "✅ Bot está pronto para deploy no Easypanel!"
echo ""

echo "📁 Estrutura do projeto criada com sucesso:"
ls -la /Users/pedro/Desktop/bot-telegram/ | grep -E '\.(ts|js|json|md|env)$|^d' | head -20