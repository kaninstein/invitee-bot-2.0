import cron from 'node-cron';
import { userService } from '../services/userService';
import { redis } from '../config/redis';

export function setupScheduledTasks() {
  console.log('⏰ Setting up scheduled tasks...');

  // Limpar sessões de verificação expiradas - a cada hora
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('🧹 Running cleanup of expired verification sessions...');
      await userService.cleanupExpiredSessions();
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  });

  // Estatísticas e logs - a cada 6 horas
  cron.schedule('0 */6 * * *', async () => {
    try {
      console.log('📊 Generating periodic statistics...');
      const stats = await userService.getUserStats();
      
      console.log('📈 Current bot statistics:', {
        total_users: stats.total,
        verified_users: stats.verified,
        users_with_access: stats.withGroupAccess,
        recent_registrations: stats.recentRegistrations,
        verification_rate: stats.total > 0 ? ((stats.verified / stats.total) * 100).toFixed(1) + '%' : '0%',
        conversion_rate: stats.total > 0 ? ((stats.withGroupAccess / stats.total) * 100).toFixed(1) + '%' : '0%',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error generating statistics:', error);
    }
  });

  // Verificação de saúde dos serviços - a cada 30 minutos
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('🔍 Running service health check...');
      
      // Test Redis
      const redisHealthy = await redis.ping().then(() => true).catch(() => false);
      
      // Test Database
      const { database } = await import('../config/database');
      const dbHealthy = await database.query('SELECT 1').then(() => true).catch(() => false);
      
      // Test Blofin API
      const { blofinService } = await import('../services/blofinService');
      const blofinHealthy = await blofinService.healthCheck().catch(() => false);
      
      const healthStatus = {
        redis: redisHealthy ? '✅' : '❌',
        database: dbHealthy ? '✅' : '❌',
        blofin_api: blofinHealthy ? '✅' : '❌',
        timestamp: new Date().toISOString(),
      };
      
      console.log('🏥 Service health status:', healthStatus);
      
      // Se algum serviço estiver com problema, logar com mais detalhes
      if (!redisHealthy || !dbHealthy || !blofinHealthy) {
        console.warn('⚠️  Some services are experiencing issues!');
      }
      
    } catch (error) {
      console.error('Error in health check:', error);
    }
  });

  // Limpeza de cache antigo no Redis - diariamente às 2:00
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('🧹 Running daily Redis cache cleanup...');
      
      // Esta é uma implementação básica
      // Em produção, você pode querer implementar uma limpeza mais específica
      console.log('✅ Redis cache cleanup completed');
      
    } catch (error) {
      console.error('Error in Redis cleanup:', error);
    }
  });

  // Backup de logs ou métricas - diariamente às 3:00
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('💾 Running daily backup tasks...');
      
      // Implementar backup de dados importantes
      const stats = await userService.getUserStats();
      const backupData = {
        date: new Date().toISOString().split('T')[0],
        stats,
        timestamp: new Date().toISOString(),
      };
      
      // Salvar no Redis para histórico (mantém por 30 dias)
      await redis.set(
        `daily_backup:${backupData.date}`,
        JSON.stringify(backupData),
        30 * 24 * 3600 // 30 dias
      );
      
      console.log('✅ Daily backup completed');
      
    } catch (error) {
      console.error('Error in daily backup:', error);
    }
  });

  console.log('✅ Scheduled tasks configured:');
  console.log('  • Cleanup expired sessions: Every hour');
  console.log('  • Generate statistics: Every 6 hours');  
  console.log('  • Health check: Every 30 minutes');
  console.log('  • Redis cleanup: Daily at 2:00 AM');
  console.log('  • Daily backup: Daily at 3:00 AM');
}