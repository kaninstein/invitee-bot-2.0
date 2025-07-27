import { database } from '../config/database';
import { Migration } from './migrationRunner';

/**
 * Registry de migrations embarcadas no código
 * Isso garante que as migrations funcionem tanto em desenvolvimento quanto em produção
 */
export const migrationRegistry: Migration[] = [
  {
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
  },

  {
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
  },

  {
    id: '003',
    name: 'create_user_activities_table',
    
    async up(): Promise<void> {
      const createUserActivitiesTable = `
        CREATE TABLE user_activities (
          id SERIAL PRIMARY KEY,
          telegram_id VARCHAR(50) NOT NULL,
          activity_type VARCHAR(50) NOT NULL CHECK (
            activity_type IN (
              'user_created', 'verification_started', 'verification_completed',
              'verification_failed', 'group_joined', 'group_left', 'command_used',
              'blofin_check', 'rate_limited', 'error_occurred'
            )
          ),
          activity_data JSONB,
          ip_address INET,
          user_agent TEXT,
          success BOOLEAN DEFAULT true,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await database.query(createUserActivitiesTable);
      
      // Criar índices
      const createIndexes = `
        CREATE INDEX idx_user_activities_telegram_id ON user_activities(telegram_id);
        CREATE INDEX idx_user_activities_type ON user_activities(activity_type);
        CREATE INDEX idx_user_activities_created_at ON user_activities(created_at);
        CREATE INDEX idx_user_activities_success ON user_activities(success);
        CREATE INDEX idx_user_activities_data_gin ON user_activities USING GIN (activity_data);
      `;

      await database.query(createIndexes);

      // Criar foreign key constraint
      const addForeignKey = `
        ALTER TABLE user_activities 
        ADD CONSTRAINT fk_user_activities_telegram_id 
        FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) 
        ON DELETE CASCADE;
      `;

      await database.query(addForeignKey);
    },

    async down(): Promise<void> {
      await database.query('DROP TABLE IF EXISTS user_activities;');
    }
  },

  {
    id: '004',
    name: 'create_system_settings_table',
    
    async up(): Promise<void> {
      const createSystemSettingsTable = `
        CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT,
          setting_type VARCHAR(20) DEFAULT 'string' CHECK (
            setting_type IN ('string', 'number', 'boolean', 'json')
          ),
          description TEXT,
          is_public BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await database.query(createSystemSettingsTable);
      
      // Criar índices
      const createIndexes = `
        CREATE INDEX idx_system_settings_key ON system_settings(setting_key);
        CREATE INDEX idx_system_settings_type ON system_settings(setting_type);
        CREATE INDEX idx_system_settings_public ON system_settings(is_public);
      `;

      await database.query(createIndexes);

      // Criar trigger para atualizar updated_at
      const createTrigger = `
        CREATE TRIGGER update_system_settings_updated_at
          BEFORE UPDATE ON system_settings
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `;

      await database.query(createTrigger);

      // Inserir configurações padrão
      const insertDefaultSettings = `
        INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
        ('bot_version', '1.0.0', 'string', 'Versão atual do bot', true),
        ('maintenance_mode', 'false', 'boolean', 'Modo de manutenção ativado', false),
        ('max_verification_attempts', '3', 'number', 'Máximo de tentativas de verificação', false),
        ('verification_timeout_hours', '24', 'number', 'Timeout para verificação em horas', false),
        ('rate_limit_enabled', 'true', 'boolean', 'Rate limiting habilitado', false),
        ('welcome_message', 'Bem-vindo ao grupo!', 'string', 'Mensagem de boas-vindas', true),
        ('blofin_api_timeout', '10000', 'number', 'Timeout da API Blofin em ms', false),
        ('auto_cleanup_enabled', 'true', 'boolean', 'Limpeza automática habilitada', false),
        ('cleanup_interval_hours', '24', 'number', 'Intervalo de limpeza em horas', false),
        ('stats_enabled', 'true', 'boolean', 'Coleta de estatísticas habilitada', true)
        ON CONFLICT (setting_key) DO NOTHING;
      `;

      await database.query(insertDefaultSettings);
    },

    async down(): Promise<void> {
      await database.query('DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;');
      await database.query('DROP TABLE IF EXISTS system_settings;');
    }
  }
];