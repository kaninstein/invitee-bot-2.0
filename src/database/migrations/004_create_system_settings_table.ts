import { database } from '../../config/database';
import { Migration } from '../migrationRunner';

const migration: Migration = {
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
};

export default migration;