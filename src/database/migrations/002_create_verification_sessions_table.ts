import { database } from '../../config/database';
import { Migration } from '../migrationRunner';

const migration: Migration = {
  id: '002',
  name: 'create_verification_sessions_table',
  
  async up(): Promise<void> {
    const createVerificationSessionsTable = `
      CREATE TABLE verification_sessions (
        id SERIAL PRIMARY KEY,
        session_token VARCHAR(100) UNIQUE NOT NULL,
        telegram_id VARCHAR(50) NOT NULL,
        blofin_uid VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending' CHECK (
          status IN ('pending', 'verified', 'expired', 'failed')
        ),
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await database.query(createVerificationSessionsTable);
    
    // Criar índices
    const createIndexes = `
      CREATE INDEX idx_verification_sessions_token ON verification_sessions(session_token);
      CREATE INDEX idx_verification_sessions_telegram_id ON verification_sessions(telegram_id);
      CREATE INDEX idx_verification_sessions_status ON verification_sessions(status);
      CREATE INDEX idx_verification_sessions_expires_at ON verification_sessions(expires_at);
      CREATE INDEX idx_verification_sessions_created_at ON verification_sessions(created_at);
    `;

    await database.query(createIndexes);

    // Criar trigger para atualizar updated_at
    const createTrigger = `
      CREATE TRIGGER update_verification_sessions_updated_at
        BEFORE UPDATE ON verification_sessions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    await database.query(createTrigger);

    // Criar foreign key constraint
    const addForeignKey = `
      ALTER TABLE verification_sessions 
      ADD CONSTRAINT fk_verification_sessions_telegram_id 
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) 
      ON DELETE CASCADE;
    `;

    await database.query(addForeignKey);
  },

  async down(): Promise<void> {
    await database.query('DROP TRIGGER IF EXISTS update_verification_sessions_updated_at ON verification_sessions;');
    await database.query('DROP TABLE IF EXISTS verification_sessions;');
  }
};

export default migration;