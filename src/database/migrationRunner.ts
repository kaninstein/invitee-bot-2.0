import { database } from '../config/database';
import { logger } from '../utils/logger';
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
    this.migrationsPath = path.join(__dirname, 'migrations');
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
   * Carrega todas as migrations disponíveis do diretório
   */
  private async loadAvailableMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = [];

    if (!fs.existsSync(this.migrationsPath)) {
      logger.warn('MIGRATIONS', `Diretório de migrations não encontrado: ${this.migrationsPath}`);
      return migrations;
    }

    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();

    for (const file of files) {
      try {
        const migrationPath = path.join(this.migrationsPath, file);
        const migration = require(migrationPath);
        
        if (migration.default) {
          migrations.push(migration.default);
        } else if (migration.up && migration.down) {
          migrations.push(migration);
        } else {
          logger.warn('MIGRATIONS', `Migration inválida: ${file}. Deve exportar 'up' e 'down' functions`);
        }
      } catch (error) {
        logger.error('MIGRATIONS', `Erro ao carregar migration ${file}`, error as Error);
      }
    }

    return migrations;
  }

  /**
   * Executa todas as migrations pendentes
   */
  async runPendingMigrations(): Promise<void> {
    try {
      logger.info('MIGRATIONS', 'Iniciando execução de migrations...');

      // Inicializar tabela de migrations
      await this.initializeMigrationsTable();

      // Carregar migrations disponíveis e executadas
      const availableMigrations = await this.loadAvailableMigrations();
      const executedMigrations = await this.getExecutedMigrations();

      // Filtrar migrations pendentes
      const pendingMigrations = availableMigrations.filter(
        migration => !executedMigrations.includes(migration.id)
      );

      if (pendingMigrations.length === 0) {
        logger.info('MIGRATIONS', 'Nenhuma migration pendente encontrada');
        return;
      }

      logger.info('MIGRATIONS', `Encontradas ${pendingMigrations.length} migrations pendentes`);

      // Executar migrations em sequência
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      logger.info('MIGRATIONS', `✅ ${pendingMigrations.length} migrations executadas com sucesso`);

    } catch (error) {
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
      logger.info('MIGRATIONS', `Executando migration: ${migration.id} - ${migration.name}`);

      // Executar a migration em uma transação
      await database.query('BEGIN');
      
      try {
        await migration.up();
        
        // Calcular checksum do arquivo
        const migrationFile = path.join(this.migrationsPath, `${migration.id}.ts`);
        let checksum = '';
        if (fs.existsSync(migrationFile)) {
          const content = fs.readFileSync(migrationFile, 'utf8');
          checksum = this.calculateChecksum(content);
        }

        // Marcar como executada
        await this.markMigrationAsExecuted(migration.id, migration.name, checksum);
        
        await database.query('COMMIT');
        
        const duration = Date.now() - startTime;
        logger.info('MIGRATIONS', `✅ Migration ${migration.id} executada em ${duration}ms`);
        
      } catch (error) {
        await database.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      logger.error('MIGRATIONS', `❌ Erro na migration ${migration.id}`, error as Error);
      throw new Error(`Migration ${migration.id} falhou: ${(error as Error).message}`);
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