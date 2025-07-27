import fs from 'fs';
import path from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  requestId?: string;
  userId?: string;
}

class Logger {
  private logLevel: LogLevel;
  private logDir: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFiles: number = 5;

  constructor() {
    this.logLevel = process.env.LOG_LEVEL ? 
      parseInt(process.env.LOG_LEVEL) : 
      (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG);
    
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatLogEntry(entry: LogEntry): string {
    const baseLog = `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`;
    
    let additionalInfo = '';
    
    if (entry.userId) {
      additionalInfo += ` | User: ${entry.userId}`;
    }
    
    if (entry.requestId) {
      additionalInfo += ` | Request: ${entry.requestId}`;
    }
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      additionalInfo += ` | Metadata: ${JSON.stringify(entry.metadata)}`;
    }
    
    if (entry.error) {
      additionalInfo += ` | Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.code) {
        additionalInfo += ` (Code: ${entry.error.code})`;
      }
      if (entry.error.stack && this.logLevel >= LogLevel.DEBUG) {
        additionalInfo += `\nStack: ${entry.error.stack}`;
      }
    }
    
    return baseLog + additionalInfo;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private async writeToFile(level: string, formattedEntry: string): Promise<void> {
    try {
      const filename = `${level.toLowerCase()}.log`;
      const filepath = path.join(this.logDir, filename);
      
      // Check file size and rotate if needed
      await this.rotateLogFile(filepath);
      
      const logLine = formattedEntry + '\n';
      fs.appendFileSync(filepath, logLine, 'utf8');
      
      // Also write to general log
      const generalFilepath = path.join(this.logDir, 'app.log');
      fs.appendFileSync(generalFilepath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async rotateLogFile(filepath: string): Promise<void> {
    try {
      if (!fs.existsSync(filepath)) return;
      
      const stats = fs.statSync(filepath);
      if (stats.size < this.maxFileSize) return;
      
      const dir = path.dirname(filepath);
      const ext = path.extname(filepath);
      const basename = path.basename(filepath, ext);
      
      // Rotate existing files
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const oldFile = path.join(dir, `${basename}.${i}${ext}`);
        const newFile = path.join(dir, `${basename}.${i + 1}${ext}`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            fs.unlinkSync(oldFile); // Delete oldest
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // Move current file to .1
      const firstRotated = path.join(dir, `${basename}.1${ext}`);
      fs.renameSync(filepath, firstRotated);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private log(level: LogLevel, levelName: string, category: string, message: string, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level: levelName,
      category,
      message,
      metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    };

    const formattedEntry = this.formatLogEntry(entry);
    
    // Console output with colors
    if (process.env.NODE_ENV !== 'production') {
      const colors = {
        ERROR: '\x1b[31m',   // Red
        WARN: '\x1b[33m',    // Yellow
        INFO: '\x1b[36m',    // Cyan
        DEBUG: '\x1b[37m',   // White
        TRACE: '\x1b[90m'    // Gray
      };
      const resetColor = '\x1b[0m';
      const color = colors[levelName as keyof typeof colors] || colors.INFO;
      
      console.log(`${color}${formattedEntry}${resetColor}`);
    }
    
    // File output
    this.writeToFile(levelName, formattedEntry);
  }

  error(category: string, message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, 'ERROR', category, message, metadata, error);
  }

  warn(category: string, message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, 'WARN', category, message, metadata);
  }

  info(category: string, message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, 'INFO', category, message, metadata);
  }

  debug(category: string, message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, 'DEBUG', category, message, metadata);
  }

  trace(category: string, message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.TRACE, 'TRACE', category, message, metadata);
  }

  // Specific logging methods for common scenarios
  apiRequest(method: string, url: string, requestId?: string, metadata?: Record<string, any>): void {
    this.info('API_REQUEST', `${method} ${url}`, { 
      method, 
      url, 
      requestId,
      ...metadata 
    });
  }

  apiResponse(method: string, url: string, status: number, duration: number, requestId?: string): void {
    this.info('API_RESPONSE', `${method} ${url} - ${status} (${duration}ms)`, {
      method,
      url,
      status,
      duration,
      requestId
    });
  }

  apiError(method: string, url: string, error: Error, requestId?: string, metadata?: Record<string, any>): void {
    this.error('API_ERROR', `${method} ${url} failed`, error, {
      method,
      url,
      requestId,
      ...metadata
    });
  }

  telegramEvent(event: string, userId?: string, metadata?: Record<string, any>): void {
    this.info('TELEGRAM_EVENT', `Event: ${event}`, {
      event,
      userId,
      ...metadata
    });
  }

  telegramError(event: string, error: Error, userId?: string, metadata?: Record<string, any>): void {
    this.error('TELEGRAM_ERROR', `Event: ${event} failed`, error, {
      event,
      userId,
      ...metadata
    });
  }

  blofinRequest(endpoint: string, requestId?: string, metadata?: Record<string, any>): void {
    this.debug('BLOFIN_REQUEST', `Calling ${endpoint}`, {
      endpoint,
      requestId,
      ...metadata
    });
  }

  blofinResponse(endpoint: string, success: boolean, code?: string, duration?: number, requestId?: string): void {
    const level = success ? 'info' : 'warn';
    this[level]('BLOFIN_RESPONSE', `${endpoint} - ${success ? 'Success' : 'Failed'}`, {
      endpoint,
      success,
      code,
      duration,
      requestId
    });
  }

  blofinError(endpoint: string, error: Error, requestId?: string, metadata?: Record<string, any>): void {
    this.error('BLOFIN_ERROR', `${endpoint} failed`, error, {
      endpoint,
      requestId,
      ...metadata
    });
  }

  userAction(action: string, userId: string, metadata?: Record<string, any>): void {
    this.info('USER_ACTION', `User ${userId}: ${action}`, {
      action,
      userId,
      ...metadata
    });
  }

  userError(action: string, userId: string, error: Error, metadata?: Record<string, any>): void {
    this.error('USER_ERROR', `User ${userId}: ${action} failed`, error, {
      action,
      userId,
      ...metadata
    });
  }

  securityEvent(event: string, severity: 'low' | 'medium' | 'high', metadata?: Record<string, any>): void {
    const eventMetadata = {
      eventName: event,
      severity,
      ...metadata
    };
    
    if (severity === 'high') {
      this.error('SECURITY', `Security event: ${event}`, undefined, eventMetadata);
    } else if (severity === 'medium') {
      this.warn('SECURITY', `Security event: ${event}`, eventMetadata);
    } else {
      this.info('SECURITY', `Security event: ${event}`, eventMetadata);
    }
  }

  performance(operation: string, duration: number, metadata?: Record<string, any>): void {
    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    this[level]('PERFORMANCE', `${operation} took ${duration}ms`, {
      operation,
      duration,
      ...metadata
    });
  }

  // Utility method to get recent logs
  getRecentLogs(level?: string, limit: number = 100): string[] {
    try {
      const filename = level ? `${level.toLowerCase()}.log` : 'app.log';
      const filepath = path.join(this.logDir, filename);
      
      if (!fs.existsSync(filepath)) return [];
      
      const content = fs.readFileSync(filepath, 'utf8');
      const lines = content.trim().split('\n');
      
      return lines.slice(-limit);
    } catch (error) {
      console.error('Failed to read log file:', error);
      return [];
    }
  }

  // Utility method to clear logs
  clearLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir);
      for (const file of files) {
        if (file.endsWith('.log')) {
          fs.unlinkSync(path.join(this.logDir, file));
        }
      }
      this.info('SYSTEM', 'Log files cleared');
    } catch (error) {
      console.error('Failed to clear log files:', error);
    }
  }
}

export const logger = new Logger();