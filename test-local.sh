#!/bin/bash

echo "🧪 Testing Telegram Crypto Bot locally..."

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build do projeto
echo "🔧 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix TypeScript errors."
    exit 1
fi

# Verificar se as variáveis essenciais estão configuradas
echo "🔍 Checking environment variables..."

if grep -q "your_blofin_api_key_here" .env; then
    echo "⚠️  WARNING: Blofin API credentials not configured yet"
    echo "   Please update BLOFIN_API_KEY, BLOFIN_SECRET_KEY, and BLOFIN_PASSPHRASE in .env"
fi

if grep -q "your_referral_code_here" .env; then
    echo "⚠️  WARNING: Blofin referral code not configured yet"
    echo "   Please update YOUR_REFERRAL_CODE in .env"
fi

# Testar conexões
echo "🔌 Testing connections..."

# Testar PostgreSQL
echo "Testing PostgreSQL connection..."
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => {
    console.log('✅ PostgreSQL connection: OK');
    return client.query('SELECT NOW()');
  })
  .then(() => client.end())
  .catch(err => {
    console.log('❌ PostgreSQL connection: FAILED');
    console.log('Error:', err.message);
  });
" 2>/dev/null

# Testar Redis
echo "Testing Redis connection..."
node -e "
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });
client.connect()
  .then(() => client.ping())
  .then(() => {
    console.log('✅ Redis connection: OK');
    return client.disconnect();
  })
  .catch(err => {
    console.log('❌ Redis connection: FAILED');
    console.log('Error:', err.message);
  });
" 2>/dev/null

echo ""
echo "🚀 Starting bot in development mode..."
echo "💡 Press Ctrl+C to stop"
echo "🔗 Health check will be available at: http://localhost:3000/health"
echo "📊 Metrics will be available at: http://localhost:3000/metrics"
echo ""

# Iniciar em modo desenvolvimento
npm run dev