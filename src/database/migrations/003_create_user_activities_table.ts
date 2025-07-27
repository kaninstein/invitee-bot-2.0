import { database } from '../../config/database';
import { Migration } from '../migrationRunner';

const migration: Migration = {
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

    // Criar partição por data (opcional para performance com muitos dados)
    const createPartitionFunction = `
      CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, start_date date)
      RETURNS void AS $$
      DECLARE
        partition_name text;
        end_date date;
      BEGIN
        partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
        end_date := start_date + interval '1 month';
        
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I 
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, table_name, start_date, end_date);
      END;
      $$ LANGUAGE plpgsql;
    `;

    await database.query(createPartitionFunction);
  },

  async down(): Promise<void> {
    await database.query('DROP FUNCTION IF EXISTS create_monthly_partition(text, date);');
    await database.query('DROP TABLE IF EXISTS user_activities;');
  }
};

export default migration;