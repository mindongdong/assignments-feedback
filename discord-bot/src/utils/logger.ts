import winston from 'winston';
import path from 'path';

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(logColors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels: logLevels,
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'discord-bot.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // File transport for error logs only
    new winston.transports.File({
      filename: path.join(logsDir, 'discord-bot-error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'discord-bot-exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'discord-bot-rejections.log'),
    }),
  ],
});

// Create a stream object for HTTP request logging (if needed)
export const loggerStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Log bot startup info
logger.info('Discord Bot Logger 초기화 완료', {
  level: logger.level,
  environment: process.env.NODE_ENV || 'development',
});

export default logger;