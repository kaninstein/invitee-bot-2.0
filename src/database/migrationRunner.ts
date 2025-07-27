import { database } from '../config/database';
import { logger } from '../utils/logger';
import { migrationRegistry } from './migrationRegistry';
import fs from 'fs';
import path from 'path';

export interface Migration {
  id: string;
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

export class MigrationRunner {
  private migrationsPath: string;

  constructor() {
    // Determinar o caminho das migrations baseado no ambiente
    const isDist = __dirname.includes('dist');
    
    if (isDist) {
      // Em produção (dist/), buscar na pasta dist
      this.migrationsPath = path.join(__dirname, 'migrations');
    } else {
      // Em desenvolvimento, usar o caminho relativo
      this.migrationsPath = path.join(__dirname, 'migrations');
    }
    
    logger.debug('MIGRATIONS', `Caminho das migrations: ${this.migrationsPath}`);
  }

  /**
   * Inicializa a tabela de migrations se não existir
   */
  private async initializeMigrationsTable(): Promise<void> {
    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        migration_id VARCHAR(255) UNIQUE NOT NULL,
        migration_name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(255)
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_migration_id ON migrations(migration_id);
    `;

    await database.query(createMigrationsTable);
    logger.info('MIGRATIONS', 'Tabela de migrations inicializada');
  }

  /**
   * Busca todas as migrations executadas
   */
  private async getExecutedMigrations(): Promise<string[]> {
    const result = await database.query(
      'SELECT migration_id FROM migrations ORDER BY id ASC'
    );
    return result.rows.map(row => row.migration_id);
  }

  /**
   * Marca uma migration como executada
   */
  private async markMigrationAsExecuted(migrationId: string, migrationName: string, checksum: string): Promise<void> {
    await database.query(
      'INSERT INTO migrations (migration_id, migration_name, checksum) VALUES ($1, $2, $3)',
      [migrationId, migrationName, checksum]
    );
  }

  /**
   * Remove migration da tabela (para rollback)
   */
  private async removeMigrationRecord(migrationId: string): Promise<void> {
    await database.query(
      'DELETE FROM migrations WHERE migration_id = $1',
      [migrationId]
    );
  }

  /**
   * Calcula checksum do arquivo de migration
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Carrega todas as migrations disponíveis do diretório ou do registry
   */
  private async loadAvailableMigrations(): Promise<Migration[]> {
    let migrations: Migration[] = [];

    logger.info('MIGRATIONS', `Procurando migrations em: ${this.migrationsPath}`);

    // Tentar carregar migrations de arquivos primeiro
    if (fs.existsSync(this.migrationsPath)) {
      const files = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
        .sort();

      logger.info('MIGRATIONS', `Encontrados ${files.length} arquivos de migration: ${files.join(', ')}`);

      for (const file of files) {
        try {
          const migrationPath = path.join(this.migrationsPath, file);
          logger.debug('MIGRATIONS', `Carregando migration: ${migrationPath}`);
          
          const migration = require(migrationPath);
          
          if (migration.default) {
            logger.debug('MIGRATIONS', `Migration ${file} carregada (default export)`);
            migrations.push(migration.default);
          } else if (migration.up && migration.down) {
            logger.debug('MIGRATIONS', `Migration ${file} carregada (named exports)`);
            migrations.push(migration);
          } else {
            logger.warn('MIGRATIONS', `Migration inválida: ${file}. Deve exportar 'up' e 'down' functions`);
          }
        } catch (error) {
          logger.error('MIGRATIONS', `Erro ao carregar migration ${file}`, error as Error);
        }
      }
    }

    // Se não encontrou migrations em arquivos, usar o registry embarcado
    if (migrations.length === 0) {
      logger.info('MIGRATIONS', 'Usando migrations do registry embarcado');
      migrations = [...migrationRegistry];
    }

    logger.info('MIGRATIONS', `${migrations.length} migrations carregadas com sucesso`);
    return migrations;
  }

  /**
   * Executa todas as migrations pendentes
   */
  async runPendingMigrations(): Promise<void> {
    try {
      console.log('🚀 INICIANDO EXECUÇÃO DE MIGRATIONS...');
      logger.info('MIGRATIONS', 'Iniciando execução de migrations...');

      // Inicializar tabela de migrations
      await this.initializeMigrationsTable();

      // Carregar migrations disponíveis e executadas
      console.log('📂 Carregando migrations disponíveis...');
      const availableMigrations = await this.loadAvailableMigrations();
      console.log(`📂 Migrations disponíveis: ${availableMigrations.map(m => m.id).join(', ')}`);
      
      const executedMigrations = await this.getExecutedMigrations();
      console.log(`✅ Migrations já executadas: ${executedMigrations.join(', ')}`);

      // Filtrar migrations pendentes
      const pendingMigrations = availableMigrations.filter(
        migration => !executedMigrations.includes(migration.id)
      );

      console.log(`⏳ Migrations pendentes: ${pendingMigrations.map(m => m.id).join(', ')}`);

      if (pendingMigrations.length === 0) {
        console.log('✅ Nenhuma migration pendente encontrada');
        logger.info('MIGRATIONS', 'Nenhuma migration pendente encontrada');
        return;
      }

      console.log(`🔄 Executando ${pendingMigrations.length} migrations pendentes...`);
      logger.info('MIGRATIONS', `Encontradas ${pendingMigrations.length} migrations pendentes`);

      // Executar migrations em sequência
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      console.log(`🎉 ${pendingMigrations.length} MIGRATIONS EXECUTADAS COM SUCESSO!`);
      logger.info('MIGRATIONS', `✅ ${pendingMigrations.length} migrations executadas com sucesso`);

    } catch (error) {
      console.log('💥 ERRO DURANTE EXECUÇÃO DE MIGRATIONS:', error);
      logger.error('MIGRATIONS', 'Erro durante execução de migrations', error as Error);
      throw error;
    }
  }

  /**
   * Executa uma migration específica
   */
  private async executeMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 EXECUTANDO MIGRATION: ${migration.id} - ${migration.name}`);
      logger.info('MIGRATIONS', `Executando migration: ${migration.id} - ${migration.name}`);

      // Executar a migration em uma transação
      await database.query('BEGIN');
      
      try {
        console.log(`   ⚙️ Executando migration.up() para ${migration.id}`);
        await migration.up();
        console.log(`   ✅ migration.up() concluída para ${migration.id}`);
        
        // Calcular checksum - tentar arquivo físico primeiro, depois usar ID da migration
        let checksum = '';
        
        if (fs.existsSync(this.migrationsPath)) {
          const files = fs.readdirSync(this.migrationsPath)
            .filter(file => file.startsWith(`${migration.id}_`))
            .filter(file => file.endsWith('.ts') || file.endsWith('.js'));
          
          if (files.length > 0) {
            const migrationFile = path.join(this.migrationsPath, files[0]);
            const content = fs.readFileSync(migrationFile, 'utf8');
            checksum = this.calculateChecksum(content);
          }
        }
        
        // Se não encontrou arquivo, usar o ID da migration como checksum
        if (!checksum) {
          checksum = this.calculateChecksum(`${migration.id}_${migration.name}`);
        }

        console.log(`   📝 Marcando migration ${migration.id} como executada`);
        // Marcar como executada
        await this.markMigrationAsExecuted(migration.id, migration.name, checksum);
        
        console.log(`   💾 Fazendo COMMIT da migration ${migration.id}`);
        await database.query('COMMIT');
        
        const duration = Date.now() - startTime;
        console.log(`✅ MIGRATION ${migration.id} CONCLUÍDA em ${duration}ms`);
        logger.info('MIGRATIONS', `✅ Migration ${migration.id} executada em ${duration}ms`);
        
      } catch (error) {
        console.log(`❌ ERRO na migration ${migration.id}, fazendo ROLLBACK:`, error);
        await database.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.log(`💥 ERRO FATAL na migration ${migration.id}:`, errorMessage);
      console.log(`💥 STACK:`, errorStack);
      
      logger.error('MIGRATIONS', `❌ Erro na migration ${migration.id}: ${errorMessage}`, error as Error, {
        migrationId: migration.id,
        migrationName: migration.name,
        errorStack
      });
      
      throw new Error(`Migration ${migration.id} falhou: ${errorMessage}`);
    }
  }

  /**
   * Faz rollback da última migration
   */
  async rollbackLastMigration(): Promise<void> {
    try {
      await this.initializeMigrationsTable();
      
      // Buscar última migration executada
      const result = await database.query(
        'SELECT migration_id, migration_name FROM migrations ORDER BY id DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        logger.info('MIGRATIONS', 'Nenhuma migration para fazer rollback');
        return;
      }

      const lastMigration = result.rows[0];
      const migrationId = lastMigration.migration_id;
      
      // Carregar a migration
      const availableMigrations = await this.loadAvailableMigrations();
      const migration = availableMigrations.find(m => m.id === migrationId);

      if (!migration) {
        throw new Error(`Migration ${migrationId} não encontrada nos arquivos`);
      }

      logger.info('MIGRATIONS', `Fazendo rollback da migration: ${migration.id} - ${migration.name}`);

      // Executar rollback em transação
      await database.query('BEGIN');
      
      try {
        await migration.down();
        await this.removeMigrationRecord(migrationId);
        await database.query('COMMIT');
        
        logger.info('MIGRATIONS', `✅ Rollback de ${migration.id} executado com sucesso`);
        
      } catch (error) {
        await database.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      logger.error('MIGRATIONS', 'Erro durante rollback', error as Error);
      throw error;
    }
  }

  /**
   * Lista status das migrations
   */
  async getMigrationStatus(): Promise<{
    executed: Array<{ id: string; name: string; executed_at: string }>;
    pending: Array<{ id: string; name: string }>;
  }> {
    await this.initializeMigrationsTable();

    // Buscar migrations executadas
    const executedResult = await database.query(
      'SELECT migration_id as id, migration_name as name, executed_at FROM migrations ORDER BY id ASC'
    );

    const executedMigrations = executedResult.rows;
    const executedIds = executedMigrations.map(m => m.id);

    // Buscar migrations disponíveis
    const availableMigrations = await this.loadAvailableMigrations();
    const pendingMigrations = availableMigrations
      .filter(m => !executedIds.includes(m.id))
      .map(m => ({ id: m.id, name: m.name }));

    return {
      executed: executedMigrations,
      pending: pendingMigrations
    };
  }

  /**
   * Verifica se há migrations pendentes
   */
  async hasPendingMigrations(): Promise<boolean> {
    const status = await this.getMigrationStatus();
    return status.pending.length > 0;
  }

  /**
   * Força re-execução de uma migration específica
   */
  async forceMigration(migrationId: string): Promise<void> {
    logger.warn('MIGRATIONS', `Forçando re-execução da migration: ${migrationId}`);
    
    const availableMigrations = await this.loadAvailableMigrations();
    const migration = availableMigrations.find(m => m.id === migrationId);

    if (!migration) {
      throw new Error(`Migration ${migrationId} não encontrada`);
    }

    // Remover registro se existir
    await this.removeMigrationRecord(migrationId);
    
    // Executar migration
    await this.executeMigration(migration);
  }
}

// Instância singleton
export const migrationRunner = new MigrationRunner();