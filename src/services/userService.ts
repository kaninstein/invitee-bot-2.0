import { database } from '../config/database';
import { redis } from '../config/redis';
import { User, VerificationSession } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

class UserService {
  /**
   * Criar ou atualizar usuário
   */
  async createOrUpdateUser(telegramData: {
    telegram_id: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): Promise<User> {
    const referralToken = uuidv4();
    
    const query = `
      INSERT INTO users (telegram_id, username, first_name, last_name, referral_token)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (telegram_id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    
    const values = [
      telegramData.telegram_id,
      telegramData.username,
      telegramData.first_name,
      telegramData.last_name,
      referralToken
    ];

    try {
      const result = await database.query(query, values);
      return result.rows[0] as User;
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw error;
    }
  }

  /**
   * Buscar usuário por Telegram ID
   */
  async getUserByTelegramId(telegramId: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE telegram_id = $1';
    
    try {
      const result = await database.query(query, [telegramId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user by telegram ID:', error);
      throw error;
    }
  }

  /**
   * Buscar usuário por referral token
   */
  async getUserByReferralToken(token: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE referral_token = $1';
    
    try {
      const result = await database.query(query, [token]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user by referral token:', error);
      throw error;
    }
  }

  /**
   * Marcar usuário como verificado na Blofin
   */
  async markUserAsVerified(userId: number): Promise<User> {
    const query = `
      UPDATE users 
      SET blofin_verified = true, group_access = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    
    try {
      const result = await database.query(query, [userId]);
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      return result.rows[0] as User;
    } catch (error) {
      console.error('Error marking user as verified:', error);
      throw error;
    }
  }

  /**
   * Incrementar tentativas de verificação
   */
  async incrementVerificationAttempts(userId: number): Promise<User> {
    const query = `
      UPDATE users 
      SET verification_attempts = verification_attempts + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    
    try {
      const result = await database.query(query, [userId]);
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      return result.rows[0] as User;
    } catch (error) {
      console.error('Error incrementing verification attempts:', error);
      throw error;
    }
  }

  /**
   * Criar sessão de verificação
   */
  async createVerificationSession(userId: number, referralToken: string): Promise<VerificationSession> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.bot.verificationTimeoutHours);

    const query = `
      INSERT INTO verification_sessions (user_id, referral_token, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    
    try {
      const result = await database.query(query, [userId, referralToken, expiresAt]);
      const session = result.rows[0] as VerificationSession;
      
      // Cache no Redis também
      await redis.cacheVerificationToken(
        referralToken, 
        userId.toString(), 
        config.bot.verificationTimeoutHours * 3600
      );
      
      return session;
    } catch (error) {
      console.error('Error creating verification session:', error);
      throw error;
    }
  }

  /**
   * Buscar sessão de verificação ativa
   */
  async getActiveVerificationSession(userId: number): Promise<VerificationSession | null> {
    const query = `
      SELECT * FROM verification_sessions 
      WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    
    try {
      const result = await database.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting active verification session:', error);
      throw error;
    }
  }

  /**
   * Limpar sessões de verificação expiradas
   */
  async cleanupExpiredSessions(): Promise<void> {
    const query = 'DELETE FROM verification_sessions WHERE expires_at <= CURRENT_TIMESTAMP';
    
    try {
      const result = await database.query(query);
      console.log(`🧹 Cleaned up ${result.rowCount} expired verification sessions`);
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }

  /**
   * Obter estatísticas de usuários
   */
  async getUserStats(): Promise<{
    total: number;
    verified: number;
    withGroupAccess: number;
    recentRegistrations: number;
  }> {
    try {
      const totalQuery = 'SELECT COUNT(*) as count FROM users';
      const verifiedQuery = 'SELECT COUNT(*) as count FROM users WHERE blofin_verified = true';
      const groupAccessQuery = 'SELECT COUNT(*) as count FROM users WHERE group_access = true';
      const recentQuery = `
        SELECT COUNT(*) as count FROM users 
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `;

      const [totalResult, verifiedResult, groupAccessResult, recentResult] = await Promise.all([
        database.query(totalQuery),
        database.query(verifiedQuery),
        database.query(groupAccessQuery),
        database.query(recentQuery)
      ]);

      return {
        total: parseInt(totalResult.rows[0].count),
        verified: parseInt(verifiedResult.rows[0].count),
        withGroupAccess: parseInt(groupAccessResult.rows[0].count),
        recentRegistrations: parseInt(recentResult.rows[0].count),
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Revogar acesso ao grupo
   */
  async revokeGroupAccess(userId: number): Promise<User> {
    const query = `
      UPDATE users 
      SET group_access = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    
    try {
      const result = await database.query(query, [userId]);
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      return result.rows[0] as User;
    } catch (error) {
      console.error('Error revoking group access:', error);
      throw error;
    }
  }

  /**
   * Obter usuários com acesso ao grupo
   */
  async getUsersWithGroupAccess(): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE group_access = true ORDER BY updated_at DESC';
    
    try {
      const result = await database.query(query);
      return result.rows as User[];
    } catch (error) {
      console.error('Error getting users with group access:', error);
      throw error;
    }
  }

  /**
   * Buscar usuários por período
   */
  async getUsersByPeriod(startDate: Date, endDate: Date): Promise<User[]> {
    const query = `
      SELECT * FROM users 
      WHERE created_at BETWEEN $1 AND $2
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await database.query(query, [startDate, endDate]);
      return result.rows as User[];
    } catch (error) {
      console.error('Error getting users by period:', error);
      throw error;
    }
  }
}

export const userService = new UserService();