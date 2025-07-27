import { database } from '../../config/database';
import { Migration } from '../migrationRunner';

const migration: Migration = {
  id: '001',
  name: 'create_users_table',
  
  async up(): Promise<void> {
    const createUsersTable = `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        telegram_id VARCHAR(50) UNIQUE NOT NULL,
        username VARCHAR(100),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        blofin_uid VARCHAR(100),
        referral_token VARCHAR(100) UNIQUE,
        verification_status VARCHAR(20) DEFAULT 'pending' CHECK (
          verification_status IN ('pending', 'verified', 'failed', 'blocked')
        ),
        verification_attempts INTEGER DEFAULT 0,
        last_verification_attempt TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await database.query(createUsersTable);
    
    // Criar índices
    const createIndexes = `
      CREATE INDEX idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX idx_users_blofin_uid ON users(blofin_uid);
      CREATE INDEX idx_users_verification_status ON users(verification_status);
      CREATE INDEX idx_users_created_at ON users(created_at);
    `;

    await database.query(createIndexes);

    // Criar trigger para atualizar updated_at
    const createTrigger = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    await database.query(createTrigger);
  },

  async down(): Promise<void> {
    await database.query('DROP TRIGGER IF EXISTS update_users_updated_at ON users;');
    await database.query('DROP FUNCTION IF EXISTS update_updated_at_column();');
    await database.query('DROP TABLE IF EXISTS users;');
  }
};

export default migration;