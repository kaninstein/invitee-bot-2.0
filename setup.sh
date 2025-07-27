#!/bin/bash

echo "🚀 Setting up Telegram Crypto Bot..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado. Por favor, instale Node.js primeiro."
    exit 1
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não está instalado. Por favor, instale npm primeiro."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔧 Building TypeScript..."
npm run build

echo "🔍 Running type check..."
npm run typecheck

if [ $? -eq 0 ]; then
    echo "✅ Setup completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Configure your Blofin API credentials in .env file"
    echo "2. Add your Telegram ID to ADMIN_IDS in src/bot/commands/admin.ts"
    echo "3. Run 'npm run dev' to start in development mode"
    echo "4. Or run 'npm start' to start in production mode"
    echo ""
    echo "🔗 Important URLs:"
    echo "- Health check: http://localhost:3000/health"
    echo "- Metrics: http://localhost:3000/metrics"
    echo ""
    echo "💡 Don't forget to configure your webhook URL in Easypanel!"
else
    echo "❌ Setup failed. Please check the errors above."
    exit 1
fi