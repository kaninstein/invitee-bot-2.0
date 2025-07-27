import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const router = Router();

// Get recent logs
router.get('/logs', (req: Request, res: Response) => {
  try {
    const { level, limit = '100', format = 'json' } = req.query;
    const logLimit = Math.min(parseInt(limit as string) || 100, 1000);
    
    logger.info('LOGS_API', `Fetching logs`, {
      requestId: req.requestId,
      level: level as string,
      limit: logLimit,
      format: format as string
    });
    
    const logs = logger.getRecentLogs(level as string, logLimit);
    
    if (format === 'text') {
      res.setHeader('Content-Type', 'text/plain');
      res.send(logs.join('\n'));
    } else {
      res.json({
        success: true,
        data: {
          logs,
          total: logs.length,
          level: level || 'all',
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('LOGS_API', 'Failed to fetch logs', error as Error, {
      requestId: req.requestId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs',
      timestamp: new Date().toISOString()
    });
  }
});

// Get log files list
router.get('/logs/files', (req: Request, res: Response) => {
  try {
    const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    
    if (!fs.existsSync(logDir)) {
      return res.json({
        success: true,
        data: {
          files: [],
          message: 'Log directory does not exist'
        }
      });
    }
    
    const files = fs.readdirSync(logDir)
      .filter(file => file.endsWith('.log'))
      .map(file => {
        const filepath = path.join(logDir, file);
        const stats = fs.statSync(filepath);
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          sizeFormatted: formatBytes(stats.size)
        };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());
    
    res.json({
      success: true,
      data: {
        files,
        totalFiles: files.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0)
      }
    });
  } catch (error) {
    logger.error('LOGS_API', 'Failed to list log files', error as Error, {
      requestId: req.requestId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to list log files',
      timestamp: new Date().toISOString()
    });
  }
});

// Download specific log file
router.get('/logs/download/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    
    // Security check: only allow .log files and prevent directory traversal
    if (!filename.endsWith('.log') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename'
      });
    }
    
    const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    const filepath = path.join(logDir, filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'Log file not found'
      });
    }
    
    logger.info('LOGS_API', `Downloading log file: ${filename}`, {
      requestId: req.requestId,
      filename
    });
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
    
  } catch (error) {
    logger.error('LOGS_API', 'Failed to download log file', error as Error, {
      requestId: req.requestId,
      filename: req.params.filename
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to download log file',
      timestamp: new Date().toISOString()
    });
  }
});

// Clear logs (requires confirmation)
router.delete('/logs', (req: Request, res: Response) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'CLEAR_ALL_LOGS') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Send { "confirm": "CLEAR_ALL_LOGS" } in request body.'
      });
    }
    
    logger.warn('LOGS_API', 'Clearing all log files', {
      requestId: req.requestId,
      ip: req.ip
    });
    
    logger.clearLogs();
    
    res.json({
      success: true,
      message: 'All log files cleared',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('LOGS_API', 'Failed to clear logs', error as Error, {
      requestId: req.requestId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear logs',
      timestamp: new Date().toISOString()
    });
  }
});

// Get log statistics
router.get('/logs/stats', (req: Request, res: Response) => {
  try {
    const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    
    if (!fs.existsSync(logDir)) {
      return res.json({
        success: true,
        data: {
          totalFiles: 0,
          totalSize: 0,
          levels: {},
          message: 'Log directory does not exist'
        }
      });
    }
    
    const files = fs.readdirSync(logDir).filter(file => file.endsWith('.log'));
    const stats = {
      totalFiles: files.length,
      totalSize: 0,
      levels: {} as Record<string, { files: number; size: number }>,
      oldestLog: null as Date | null,
      newestLog: null as Date | null
    };
    
    files.forEach(file => {
      const filepath = path.join(logDir, file);
      const fileStats = fs.statSync(filepath);
      const level = file.replace('.log', '').toUpperCase();
      
      stats.totalSize += fileStats.size;
      
      if (!stats.levels[level]) {
        stats.levels[level] = { files: 0, size: 0 };
      }
      stats.levels[level].files++;
      stats.levels[level].size += fileStats.size;
      
      if (!stats.oldestLog || fileStats.birthtime < stats.oldestLog) {
        stats.oldestLog = fileStats.birthtime;
      }
      if (!stats.newestLog || fileStats.mtime > stats.newestLog) {
        stats.newestLog = fileStats.mtime;
      }
    });
    
    res.json({
      success: true,
      data: {
        ...stats,
        totalSizeFormatted: formatBytes(stats.totalSize),
        levels: Object.fromEntries(
          Object.entries(stats.levels).map(([level, data]) => [
            level,
            {
              ...data,
              sizeFormatted: formatBytes(data.size)
            }
          ])
        )
      }
    });
    
  } catch (error) {
    logger.error('LOGS_API', 'Failed to get log statistics', error as Error, {
      requestId: req.requestId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get log statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// Search logs
router.post('/logs/search', (req: Request, res: Response) => {
  try {
    const { query, level, limit = 100, caseSensitive = false } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required and must be a string'
      });
    }
    
    const logs = logger.getRecentLogs(level, Math.min(limit, 1000));
    const searchQuery = caseSensitive ? query : query.toLowerCase();
    
    const results = logs.filter(log => {
      const searchText = caseSensitive ? log : log.toLowerCase();
      return searchText.includes(searchQuery);
    });
    
    logger.info('LOGS_API', `Log search completed`, {
      requestId: req.requestId,
      query: query.substring(0, 100), // Limit logged query length
      level,
      totalLogs: logs.length,
      matchedLogs: results.length,
      caseSensitive
    });
    
    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        query,
        level: level || 'all',
        caseSensitive,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('LOGS_API', 'Failed to search logs', error as Error, {
      requestId: req.requestId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to search logs',
      timestamp: new Date().toISOString()
    });
  }
});

// Utility function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;