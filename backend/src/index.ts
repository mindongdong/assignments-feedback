import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';

// Routes
import authRoutes from './routes/auth';
import assignmentRoutes from './routes/assignments';
import submissionRoutes from './routes/submissions';
import userRoutes from './routes/users';

// Services
import { CacheService } from './services/CacheService';
import { AIService } from './services/AIService';

const app = express();
const server = createServer(app);

// Initialize database and cache
export const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Initialize services
export const cacheService = new CacheService(redis);
export const aiService = new AIService();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// General middleware
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/users', userRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '요청한 리소스를 찾을 수 없습니다.',
      timestamp: new Date().toISOString(),
    },
  });
});

const PORT = process.env.PORT || 3001;

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  
  server.close(async () => {
    try {
      await prisma.$disconnect();
      await redis.quit();
      logger.info('Database and cache connections closed.');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Backend server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;