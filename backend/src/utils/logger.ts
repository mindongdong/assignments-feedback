/**
 * Logger utility with Korean language support and performance monitoring
 */

import * as winston from 'winston';
import * as path from 'path';

// Custom log format for Korean text
const koreanLogFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Handle Korean text properly
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
  })
);

// Logger configuration
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: koreanLogFormat,
  defaultMeta: { service: 'discord-assignments' },
  transports: [
    // Console output for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        koreanLogFormat
      ),
    }),
    
    // File output for production
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
    }),
  ],
});

// Performance logging utility
export class PerformanceLogger {
  private startTime: number;
  private operation: string;
  private discordId?: string;

  constructor(operation: string, discordId?: string) {
    this.operation = operation;
    this.discordId = discordId;
    this.startTime = Date.now();
  }

  end(success: boolean = true, errorMessage?: string): number {
    const duration = Date.now() - this.startTime;
    
    logger.info(`Performance: ${this.operation}`, {
      duration,
      success,
      discordId: this.discordId,
      errorMessage,
    });

    // Log slow operations (>100ms for Discord optimization)
    if (duration > 100) {
      logger.warn(`Slow operation detected: ${this.operation} took ${duration}ms`);
    }

    return duration;
  }
}

export default logger;