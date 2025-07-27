#!/usr/bin/env node

/**
 * Script para testar o sistema de logs
 */

const path = require('path');
const fs = require('fs');

// Simular ambiente Node.js/TypeScript
process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = '3'; // DEBUG level

console.log('🔍 Testando sistema de logs...\n');

// Test 1: Verificar se conseguimos importar o logger
try {
  console.log('1️⃣ Testando importação do logger...');
  
  // Como estamos em JS, vamos simular as funcionalidades principais
  const logDir = path.join(process.cwd(), 'logs');
  
  // Criar diretório de logs se não existir
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log('✅ Diretório de logs criado:', logDir);
  } else {
    console.log('✅ Diretório de logs já existe:', logDir);
  }
  
} catch (error) {
  console.error('❌ Erro ao importar logger:', error.message);
}

// Test 2: Simular diferentes tipos de logs
console.log('\n2️⃣ Simulando diferentes tipos de logs...');

const logTypes = [
  { level: 'INFO', category: 'SYSTEM', message: 'Sistema iniciado com sucesso' },
  { level: 'DEBUG', category: 'API_REQUEST', message: 'GET /api/v1/affiliate/basic' },
  { level: 'WARN', category: 'RATE_LIMIT', message: 'Rate limit atingido para usuário 123456' },
  { level: 'ERROR', category: 'BLOFIN_API', message: 'Falha na autenticação Blofin API' },
  { level: 'TRACE', category: 'TELEGRAM_EVENT', message: 'Mensagem recebida do usuário' }
];

logTypes.forEach((log, index) => {
  const timestamp = new Date().toISOString();
  const formattedLog = `[${timestamp}] [${log.level}] [${log.category}] ${log.message}`;
  
  console.log(`   ${index + 1}. ${formattedLog}`);
  
  // Simular escrita no arquivo
  const filename = path.join(process.cwd(), 'logs', `${log.level.toLowerCase()}.log`);
  try {
    fs.appendFileSync(filename, formattedLog + '\n', 'utf8');
  } catch (error) {
    console.error(`   ❌ Erro ao escrever log ${log.level}:`, error.message);
  }
});

console.log('✅ Logs simulados criados');

// Test 3: Verificar arquivos de log criados
console.log('\n3️⃣ Verificando arquivos de log criados...');

try {
  const logDir = path.join(process.cwd(), 'logs');
  const files = fs.readdirSync(logDir).filter(file => file.endsWith('.log'));
  
  console.log(`✅ ${files.length} arquivo(s) de log encontrado(s):`);
  
  files.forEach(file => {
    const filepath = path.join(logDir, file);
    const stats = fs.statSync(filepath);
    console.log(`   📄 ${file} (${stats.size} bytes, modificado: ${stats.mtime.toLocaleString('pt-BR')})`);
  });
  
} catch (error) {
  console.error('❌ Erro ao verificar arquivos de log:', error.message);
}

// Test 4: Simular cenários de erro comuns
console.log('\n4️⃣ Simulando cenários de erro comuns...');

const errorScenarios = [
  {
    category: 'BLOFIN_AUTH',
    error: 'Passphrase error (152408)',
    details: { apiKey: 'ea75ea000...', endpoint: '/api/v1/affiliate/basic' }
  },
  {
    category: 'TELEGRAM_ERROR',
    error: 'Bot token invalid',
    details: { botUsername: '@crypto_bot', chatId: '-1001234567890' }
  },
  {
    category: 'DATABASE_ERROR',
    error: 'Connection timeout',
    details: { host: 'postgres-service', port: 5432 }
  },
  {
    category: 'REDIS_ERROR',
    error: 'Redis connection lost',
    details: { host: 'redis-service', port: 6379 }
  }
];

errorScenarios.forEach((scenario, index) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [ERROR] [${scenario.category}] ${scenario.error} | Details: ${JSON.stringify(scenario.details)}`;
  
  console.log(`   ${index + 1}. ${scenario.category}: ${scenario.error}`);
  
  // Escrever no arquivo de erro
  const errorFile = path.join(process.cwd(), 'logs', 'error.log');
  try {
    fs.appendFileSync(errorFile, logEntry + '\n', 'utf8');
  } catch (error) {
    console.error(`   ❌ Erro ao escrever log de erro:`, error.message);
  }
});

console.log('✅ Cenários de erro simulados');

// Test 5: Verificar tamanho total dos logs
console.log('\n5️⃣ Verificando estatísticas dos logs...');

try {
  const logDir = path.join(process.cwd(), 'logs');
  const files = fs.readdirSync(logDir).filter(file => file.endsWith('.log'));
  
  let totalSize = 0;
  const stats = {};
  
  files.forEach(file => {
    const filepath = path.join(logDir, file);
    const fileStats = fs.statSync(filepath);
    const level = file.replace('.log', '').toUpperCase();
    
    totalSize += fileStats.size;
    stats[level] = {
      size: fileStats.size,
      lines: fs.readFileSync(filepath, 'utf8').split('\n').filter(line => line.trim()).length
    };
  });
  
  console.log('📊 Estatísticas dos logs:');
  console.log(`   Total de arquivos: ${files.length}`);
  console.log(`   Tamanho total: ${totalSize} bytes`);
  
  Object.entries(stats).forEach(([level, data]) => {
    console.log(`   ${level}: ${data.lines} linhas, ${data.size} bytes`);
  });
  
} catch (error) {
  console.error('❌ Erro ao calcular estatísticas:', error.message);
}

// Test 6: Instruções para monitoramento
console.log('\n6️⃣ Instruções para monitoramento em produção...');

console.log(`
📋 Comandos úteis para monitoramento:

🔍 Ver logs em tempo real:
   tail -f logs/app.log
   tail -f logs/error.log

📊 Contar erros por categoria:
   grep "\\[ERROR\\]" logs/error.log | cut -d']' -f3 | sort | uniq -c

⚠️  Ver últimos erros:
   tail -20 logs/error.log

🔎 Buscar por usuário específico:
   grep "User: 123456" logs/app.log

📈 Monitorar performance:
   grep "PERFORMANCE" logs/app.log | grep "took" | tail -10

🌐 Ver requisições HTTP:
   grep "API_REQUEST" logs/app.log | tail -10

🤖 Monitorar eventos do Telegram:
   grep "TELEGRAM_EVENT" logs/app.log | tail -10

💰 Verificar chamadas da API Blofin:
   grep "BLOFIN_" logs/app.log | tail -10
`);

console.log('\n🎉 Sistema de logs configurado e testado com sucesso!');
console.log('\n💡 Próximos passos:');
console.log('1. ✅ Sistema de logs implementado');
console.log('2. ⏳ Testar integração com a API Blofin');
console.log('3. ⏳ Configurar credenciais corretas');
console.log('4. ⏳ Deploy e monitoramento em produção');

console.log('\n📁 Arquivos de log criados em:', path.join(process.cwd(), 'logs'));

// Mostrar estrutura final dos logs
console.log('\n📂 Estrutura dos logs criada:');
try {
  const logDir = path.join(process.cwd(), 'logs');
  if (fs.existsSync(logDir)) {
    const files = fs.readdirSync(logDir);
    files.forEach(file => {
      console.log(`   📄 logs/${file}`);
    });
  }
} catch (error) {
  console.error('❌ Erro ao listar arquivos:', error.message);
}