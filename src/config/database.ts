import { Pool, PoolClient } from 'pg';
import { config } from './index';

class Database {
  private pool: Pool;
  
  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      ssl: config.app.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    const res = await this.pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async close() {
    await this.pool.end();
  }

  async initTables() {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id VARCHAR(50) UNIQUE NOT NULL,
        username VARCHAR(100),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        referral_token VARCHAR(100) UNIQUE NOT NULL,
        blofin_verified BOOLEAN DEFAULT FALSE,
        group_access BOOLEAN DEFAULT FALSE,
        verification_attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createVerificationSessionsTable = `
      CREATE TABLE IF NOT EXISTS verification_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        referral_token VARCHAR(100) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_users_referral_token ON users(referral_token);
      CREATE INDEX IF NOT EXISTS idx_verification_sessions_user_id ON verification_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_verification_sessions_token ON verification_sessions(referral_token);
    `;

    const createUpdateTrigger = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    try {
      await this.query(createUsersTable);
      await this.query(createVerificationSessionsTable);
      await this.query(createIndexes);
      await this.query(createUpdateTrigger);
      console.log('✅ Database tables initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing database tables:', error);
      throw error;
    }
  }
}

export const database = new Database();

export async function connectDatabase() {
  try {
    await database.query('SELECT NOW()');
    await database.initTables();
    console.log('✅ Database connected and initialized');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    throw error;
  }
}