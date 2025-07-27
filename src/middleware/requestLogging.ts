import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  req.requestId = requestId;
  req.startTime = startTime;
  
  // Log incoming request
  logger.apiRequest(req.method, req.originalUrl, requestId, {
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    headers: {
      'content-type': req.get('Content-Type'),
      'authorization': req.get('Authorization') ? '***' : undefined,
      'x-forwarded-for': req.get('X-Forwarded-For')
    },
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    bodySize: req.get('Content-Length')
  });
  
  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(...args: any[]) {
    const duration = Date.now() - startTime;
    
    logger.apiResponse(req.method, req.originalUrl, res.statusCode, duration, requestId);
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('PERFORMANCE', `Slow request detected: ${req.method} ${req.originalUrl}`, {
        requestId,
        duration,
        statusCode: res.statusCode,
        threshold: '1000ms'
      });
    }
    
    // Log error responses
    if (res.statusCode >= 400) {
      logger.warn('HTTP_ERROR', `HTTP error response: ${req.method} ${req.originalUrl}`, {
        requestId,
        statusCode: res.statusCode,
        duration
      });
    }
    
    return originalEnd(...args);
  };
  
  next();
};

export const errorLoggingMiddleware = (error: any, req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.requestId || 'unknown';
  const duration = req.startTime ? Date.now() - req.startTime : 0;
  
  logger.apiError(req.method, req.originalUrl, error, requestId, {
    statusCode: res.statusCode,
    duration,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });
  
  next(error);
};