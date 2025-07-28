import { database } from '../../config/database';
import { Migration } from '../migrationRunner';

const migration: Migration = {
  id: '005',
  name: 'add_blofin_fields',
  
  async up(): Promise<void> {
    // Adicionar campos que faltam para funcionalidade Blofin
    const addColumnsQuery = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS blofin_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS group_access BOOLEAN DEFAULT false;
    `;

    await database.query(addColumnsQuery);
    
    // Criar índices para os novos campos
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_users_blofin_verified ON users(blofin_verified);
      CREATE INDEX IF NOT EXISTS idx_users_group_access ON users(group_access);
    `;

    await database.query(createIndexesQuery);
    
    console.log('✅ Campos blofin_verified e group_access adicionados à tabela users');
  },

  async down(): Promise<void> {
    const dropColumnsQuery = `
      ALTER TABLE users 
      DROP COLUMN IF EXISTS blofin_verified,
      DROP COLUMN IF EXISTS group_access;
    `;
    
    await database.query(dropColumnsQuery);
  }
};

export default migration;