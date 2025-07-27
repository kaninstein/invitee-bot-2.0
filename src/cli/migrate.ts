#!/usr/bin/env node

import { config } from '../config';
import { migrationRunner } from '../database/migrationRunner';
import { logger } from '../utils/logger';

const command = process.argv[2];
const args = process.argv.slice(3);

async function runCommand() {
  try {
    // Validar configuração básica
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL não configurado');
      process.exit(1);
    }

    switch (command) {
      case 'up':
        await runMigrations();
        break;
      
      case 'down':
        await rollbackMigration();
        break;
      
      case 'status':
        await showMigrationStatus();
        break;
      
      case 'force':
        await forceMigration(args[0]);
        break;
      
      case 'create':
        await createMigration(args[0]);
        break;
      
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('❌ Erro:', (error as Error).message);
    process.exit(1);
  }
}

async function runMigrations() {
  console.log('🔄 Executando migrations...');
  await migrationRunner.runPendingMigrations();
  console.log('✅ Migrations executadas com sucesso!');
}

async function rollbackMigration() {
  console.log('⏪ Fazendo rollback da última migration...');
  await migrationRunner.rollbackLastMigration();
  console.log('✅ Rollback executado com sucesso!');
}

async function showMigrationStatus() {
  console.log('📊 Status das migrations:\n');
  
  const status = await migrationRunner.getMigrationStatus();
  
  if (status.executed.length > 0) {
    console.log('✅ Migrations executadas:');
    status.executed.forEach(migration => {
      console.log(`  - ${migration.id}: ${migration.name} (${migration.executed_at})`);
    });
    console.log('');
  }
  
  if (status.pending.length > 0) {
    console.log('⏳ Migrations pendentes:');
    status.pending.forEach(migration => {
      console.log(`  - ${migration.id}: ${migration.name}`);
    });
    console.log('');
  }
  
  if (status.executed.length === 0 && status.pending.length === 0) {
    console.log('📝 Nenhuma migration encontrada.');
  }
  
  console.log(`Total: ${status.executed.length} executadas, ${status.pending.length} pendentes`);
}

async function forceMigration(migrationId: string) {
  if (!migrationId) {
    console.error('❌ ID da migration é obrigatório');
    process.exit(1);
  }
  
  console.log(`🔄 Forçando re-execução da migration: ${migrationId}`);
  await migrationRunner.forceMigration(migrationId);
  console.log('✅ Migration forçada com sucesso!');
}

async function createMigration(migrationName: string) {
  if (!migrationName) {
    console.error('❌ Nome da migration é obrigatório');
    process.exit(1);
  }
  
  const fs = require('fs');
  const path = require('path');
  
  // Gerar próximo ID
  const migrationsDir = path.join(__dirname, '../database/migrations');
  const files = fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.ts'));
  const lastId = files.length > 0 ? 
    Math.max(...files.map((f: string) => parseInt(f.split('_')[0]))) : 0;
  const nextId = String(lastId + 1).padStart(3, '0');
  
  // Gerar nome do arquivo
  const fileName = `${nextId}_${migrationName.toLowerCase().replace(/\s+/g, '_')}.ts`;
  const filePath = path.join(migrationsDir, fileName);
  
  // Template da migration
  const template = `import { database } from '../../config/database';
import { Migration } from '../migrationRunner';

const migration: Migration = {
  id: '${nextId}',
  name: '${migrationName.toLowerCase().replace(/\s+/g, '_')}',
  
  async up(): Promise<void> {
    // TODO: Implementar migration
    // Exemplo:
    // await database.query('ALTER TABLE users ADD COLUMN new_field VARCHAR(255);');
  },

  async down(): Promise<void> {
    // TODO: Implementar rollback
    // Exemplo:
    // await database.query('ALTER TABLE users DROP COLUMN new_field;');
  }
};

export default migration;
`;

  fs.writeFileSync(filePath, template);
  console.log(`✅ Migration criada: ${fileName}`);
  console.log(`📝 Edite o arquivo: ${filePath}`);
}

function showHelp() {
  console.log(`
🗄️  Sistema de Migrations - Bot Telegram Crypto

Uso: npm run migrate <comando> [argumentos]

Comandos disponíveis:

  up               Executa todas as migrations pendentes
  down             Faz rollback da última migration executada
  status           Mostra o status de todas as migrations
  force <id>       Força re-execução de uma migration específica
  create <nome>    Cria uma nova migration com o nome especificado

Exemplos:

  npm run migrate up              # Executa migrations pendentes
  npm run migrate down            # Rollback da última migration
  npm run migrate status          # Ver status das migrations
  npm run migrate force 001       # Re-executar migration 001
  npm run migrate create "add_user_field"  # Criar nova migration

Variáveis de ambiente necessárias:
  - DATABASE_URL: String de conexão PostgreSQL

Para mais informações, consulte a documentação.
`);
}

// Executar comando se chamado diretamente
if (require.main === module) {
  runCommand().catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

export { runCommand };