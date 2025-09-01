import { createClient, RedisClientType } from 'redis';
import { config } from './index';

class RedisCache {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error('Redis connection failed after 3 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('❌ Redis disconnected');
      this.isConnected = false;
    });
  }

  async connect() {
    if (!this.isConnected && !this.client.isOpen) {
      await this.client.connect();
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  async set(key: string, value: string, expireInSeconds?: number): Promise<void> {
    try {
      if (expireInSeconds) {
        await this.client.setEx(key, expireInSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      console.error('Redis SET error:', error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error('Redis GET error:', error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis DEL error:', error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      throw error;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error('Redis INCR error:', error);
      throw error;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
      throw error;
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      console.error('Redis PING error:', error);
      throw error;
    }
  }

  // Cache patterns para o bot
  async cacheUserSession(telegramId: string, sessionData: any, expireInSeconds: number = 3600): Promise<void> {
    const key = `user_session:${telegramId}`;
    await this.set(key, JSON.stringify(sessionData), expireInSeconds);
  }

  async getUserSession(telegramId: string): Promise<any | null> {
    const key = `user_session:${telegramId}`;
    const data = await this.get(key);
    return data ? JSON.parse(data) : null;
  }

  async clearUserSession(telegramId: string): Promise<void> {
    const key = `user_session:${telegramId}`;
    await this.del(key);
  }

  async setRateLimit(identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
    const key = `rate_limit:${identifier}`;
    const current = await this.incr(key);
    
    if (current === 1) {
      await this.expire(key, windowSeconds);
    }
    
    return current <= limit;
  }

  async cacheVerificationToken(token: string, telegramId: string, expireInSeconds: number = 86400): Promise<void> {
    const key = `verification_token:${token}`;
    await this.set(key, telegramId, expireInSeconds);
  }

  async getVerificationToken(token: string): Promise<string | null> {
    const key = `verification_token:${token}`;
    return await this.get(key);
  }

  async clearVerificationToken(token: string): Promise<void> {
    const key = `verification_token:${token}`;
    await this.del(key);
  }

  // Distributed locking methods
  async setNX(key: string, value: string, expireInSeconds?: number): Promise<string | null> {
    try {
      if (expireInSeconds) {
        return await this.client.set(key, value, {
          NX: true,
          EX: expireInSeconds
        });
      } else {
        return await this.client.set(key, value, {
          NX: true
        });
      }
    } catch (error) {
      console.error('Redis SETNX error:', error);
      throw error;
    }
  }
}

export const redis = new RedisCache();

export async function connectRedis() {
  try {
    await redis.connect();
    await redis.ping();
    console.log('✅ Redis connected and ready');
  } catch (error) {
    console.error('❌ Redis connection error:', error);
    throw error;
  }
}