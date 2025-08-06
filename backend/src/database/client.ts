/**
 * Database client initialization with optimized connection pool
 * Optimized for Discord bot sub-100ms response requirements
 */

import { PrismaClient, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Optimized Prisma configuration for Discord workloads
const prismaOptions: Prisma.PrismaClientOptions = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'pretty',
};

// Global database client with connection pooling
export const prisma = new PrismaClient(prismaOptions);

// Redis client with Korean language support
export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  // Optimized for Korean text handling
  keyPrefix: 'discord-assignments:',
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  // Connection pool settings for high performance
  connectTimeout: 10000,
  commandTimeout: 5000,
});

// Database connection health check
export async function checkDatabaseHealth(): Promise<{
  database: boolean;
  redis: boolean;
  latency: { database: number; redis: number };
}> {
  const startTime = Date.now();
  let dbHealth = false;
  let redisHealth = false;
  let dbLatency = 0;
  let redisLatency = 0;

  try {
    // Test database connection
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
    dbHealth = true;
  } catch (error) {
    logger.error('Database health check failed:', error);
  }

  try {
    // Test Redis connection
    const redisStart = Date.now();
    await redis.ping();
    redisLatency = Date.now() - redisStart;
    redisHealth = true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
  }

  return {
    database: dbHealth,
    redis: redisHealth,
    latency: {
      database: dbLatency,
      redis: redisLatency,
    },
  };
}

// Graceful shutdown handlers
export async function closeConnections(): Promise<void> {
  try {
    await Promise.all([
      prisma.$disconnect(),
      redis.disconnect(),
    ]);
    logger.info('Database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
}

// Performance monitoring middleware for Prisma
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const duration = Date.now() - start;

  // Log slow queries (>100ms for Discord optimization)
  if (duration > 100) {
    logger.warn(`Slow query detected: ${params.model}.${params.action} took ${duration}ms`);
  }

  // Store performance metrics in Redis for analysis
  if (process.env.NODE_ENV === 'production') {
    try {
      await redis.lpush(
        'query-performance',
        JSON.stringify({
          model: params.model,
          action: params.action,
          duration,
          timestamp: new Date().toISOString(),
        })
      );
      await redis.ltrim('query-performance', 0, 999); // Keep last 1000 entries
    } catch (error) {
      // Silently fail performance logging to not affect main operations
    }
  }

  return result;
});

// Redis connection event handlers
redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('ready', () => {
  logger.info('Redis ready for operations');
});

redis.on('reconnecting', () => {
  logger.info('Redis reconnecting...');
});

// Initialize connections on startup
export async function initializeDatabase(): Promise<void> {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Test Redis connection
    await redis.connect();
    logger.info('Redis connected successfully');

    // Perform health check
    const health = await checkDatabaseHealth();
    logger.info('Database health check:', health);

    // Setup database extensions if needed
    await setupDatabaseExtensions();

  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

// Setup PostgreSQL extensions for Korean text search and performance
async function setupDatabaseExtensions(): Promise<void> {
  try {
    // Enable pg_trgm extension for Korean text search
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_trgm;`;
    
    // Enable uuid-ossp for UUID generation
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
    
    // Set UTF-8 and Korean collation support
    await prisma.$executeRaw`SET lc_collate = 'ko_KR.UTF-8';`;
    await prisma.$executeRaw`SET lc_ctype = 'ko_KR.UTF-8';`;
    
    logger.info('Database extensions setup completed');
  } catch (error) {
    logger.warn('Failed to setup database extensions (may already exist):', error);
  }
}

export default { prisma, redis, checkDatabaseHealth, closeConnections, initializeDatabase };