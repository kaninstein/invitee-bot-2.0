import { Router, Request, Response } from 'express';
import { database } from '../config/database';
import { redis } from '../config/redis';
import { blofinService } from '../services/blofinService';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    blofin_api: 'ok' | 'error';
  };
  error?: string;
}

router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'error',
      redis: 'error',
      blofin_api: 'error',
    },
  };

  try {
    // Test database connection
    try {
      await database.query('SELECT 1');
      healthStatus.services.database = 'ok';
    } catch (dbError) {
      console.error('Database health check failed:', dbError);
      healthStatus.services.database = 'error';
    }

    // Test Redis connection
    try {
      await redis.ping();
      healthStatus.services.redis = 'ok';
    } catch (redisError) {
      console.error('Redis health check failed:', redisError);
      healthStatus.services.redis = 'error';
    }

    // Test Blofin API connection
    try {
      const blofinHealthy = await blofinService.healthCheck();
      healthStatus.services.blofin_api = blofinHealthy ? 'ok' : 'error';
    } catch (blofinError) {
      console.error('Blofin API health check failed:', blofinError);
      healthStatus.services.blofin_api = 'error';
    }

    // Determine overall health
    const hasErrors = Object.values(healthStatus.services).some(status => status === 'error');
    
    if (hasErrors) {
      healthStatus.status = 'unhealthy';
      res.status(503);
    } else {
      res.status(200);
    }

    const responseTime = Date.now() - startTime;
    
    res.json({
      ...healthStatus,
      response_time_ms: responseTime,
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    healthStatus.status = 'unhealthy';
    healthStatus.error = error instanceof Error ? error.message : 'Unknown error';
    
    res.status(503).json({
      ...healthStatus,
      response_time_ms: Date.now() - startTime,
    });
  }
});

router.get('/health/database', async (req: Request, res: Response) => {
  try {
    const result = await database.query('SELECT NOW() as current_time, version() as version');
    res.json({
      status: 'ok',
      current_time: result.rows[0].current_time,
      version: result.rows[0].version,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Database connection failed',
    });
  }
});

router.get('/health/redis', async (req: Request, res: Response) => {
  try {
    const pong = await redis.ping();
    await redis.set('health_check', 'ok', 60);
    const testValue = await redis.get('health_check');
    
    res.json({
      status: 'ok',
      ping: pong,
      test_set_get: testValue === 'ok' ? 'passed' : 'failed',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Redis connection failed',
    });
  }
});

router.get('/health/blofin', async (req: Request, res: Response) => {
  try {
    const isHealthy = await blofinService.healthCheck();
    
    if (isHealthy) {
      res.json({
        status: 'ok',
        api_connection: 'working',
      });
    } else {
      res.status(503).json({
        status: 'error',
        api_connection: 'failed',
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Blofin API connection failed',
    });
  }
});

export default router;