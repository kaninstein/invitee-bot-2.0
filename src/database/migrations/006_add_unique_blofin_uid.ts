import { database } from '../../config/database';
import { Migration } from '../migrationRunner';

const migration: Migration = {
  id: '006',
  name: 'add_unique_blofin_uid',
  
  async up(): Promise<void> {
    // Primeiro, garantir que o campo blofin_uid existe
    const addBlofinUidColumnQuery = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS blofin_uid VARCHAR(100);
    `;
    
    await database.query(addBlofinUidColumnQuery);
    console.log('✅ Campo blofin_uid garantido na tabela users');

    // Segundo, verificar se há UIDs duplicados existentes
    const checkDuplicatesQuery = `
      SELECT blofin_uid, COUNT(*) as count 
      FROM users 
      WHERE blofin_uid IS NOT NULL AND blofin_uid != '' AND blofin_verified = true
      GROUP BY blofin_uid 
      HAVING COUNT(*) > 1;
    `;
    
    const duplicates = await database.query(checkDuplicatesQuery);
    
    if (duplicates.rows.length > 0) {
      console.warn('⚠️ UIDs duplicados encontrados:', duplicates.rows);
      
      // Para cada UID duplicado, manter apenas o mais antigo verificado
      for (const duplicate of duplicates.rows) {
        const keepOldestQuery = `
          UPDATE users 
          SET blofin_verified = false, group_access = false 
          WHERE blofin_uid = $1 
            AND blofin_verified = true 
            AND id NOT IN (
              SELECT id FROM users 
              WHERE blofin_uid = $1 AND blofin_verified = true 
              ORDER BY updated_at ASC 
              LIMIT 1
            );
        `;
        
        await database.query(keepOldestQuery, [duplicate.blofin_uid]);
        console.log(`🔧 UID duplicado ${duplicate.blofin_uid} limpo - mantido apenas o mais antigo`);
      }
    }

    // Adicionar constraint UNIQUE para blofin_uid quando verificado
    const addConstraintQuery = `
      CREATE UNIQUE INDEX idx_users_blofin_uid_verified 
      ON users (blofin_uid) 
      WHERE blofin_verified = true AND blofin_uid IS NOT NULL AND blofin_uid != '';
    `;

    await database.query(addConstraintQuery);
    console.log('✅ Constraint UNIQUE adicionada para blofin_uid quando verificado');
  },

  async down(): Promise<void> {
    await database.query('DROP INDEX IF EXISTS idx_users_blofin_uid_verified;');
  }
};

export default migration;