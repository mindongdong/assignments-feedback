import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { ErrorCodes } from '../utils/errors';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
}

export class CacheService {
  private redis: Redis;
  private defaultTTL: number = 300; // 5 minutes

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string, prefix?: string): Promise<T | null> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      const value = await this.redis.get(fullKey);
      
      if (value === null) {
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      return null; // Return null on error to allow fallback to database
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string, 
    value: any, 
    ttl: number = this.defaultTTL, 
    prefix?: string
  ): Promise<boolean> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      const serializedValue = JSON.stringify(value);
      
      if (ttl > 0) {
        await this.redis.setex(fullKey, ttl, serializedValue);
      } else {
        await this.redis.set(fullKey, serializedValue);
      }
      
      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error });
      return false; // Don't throw error, just log and continue
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string, prefix?: string): Promise<boolean> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      const result = await this.redis.del(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await this.redis.del(...keys);
      return result;
    } catch (error) {
      logger.error('Cache delete pattern error:', { pattern, error });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', { key, error });
      return false;
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl = this.defaultTTL, prefix } = options;
    
    // Try to get from cache first
    const cached = await this.get<T>(key, prefix);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const value = await fetchFn();
    
    // Store in cache (don't await to avoid blocking)
    this.set(key, value, ttl, prefix).catch(error => {
      logger.error('Background cache set failed:', { key, error });
    });

    return value;
  }

  /**
   * Increment counter
   */
  async increment(key: string, prefix?: string): Promise<number> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      return await this.redis.incr(fullKey);
    } catch (error) {
      logger.error('Cache increment error:', { key, error });
      throw error;
    }
  }

  /**
   * Set expiration time for existing key
   */
  async expire(key: string, ttl: number, prefix?: string): Promise<boolean> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      const result = await this.redis.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      logger.error('Cache expire error:', { key, error });
      return false;
    }
  }

  /**
   * Get remaining TTL for key
   */
  async ttl(key: string, prefix?: string): Promise<number> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      return await this.redis.ttl(fullKey);
    } catch (error) {
      logger.error('Cache TTL error:', { key, error });
      return -1;
    }
  }

  /**
   * Cache invalidation methods for specific patterns
   */
  async invalidateAssignment(assignmentCode: string): Promise<void> {
    try {
      await Promise.all([
        this.del(`assignment:${assignmentCode}`),
        this.delPattern(`assignments:list:*`),
        this.delPattern(`user:*:submissions:${assignmentCode}`),
      ]);
    } catch (error) {
      logger.error('Assignment cache invalidation error:', { assignmentCode, error });
    }
  }

  async invalidateUserSubmissions(userId: string, assignmentCode?: string): Promise<void> {
    try {
      const patterns = [
        `user:${userId}:submissions`,
        `user:${userId}:status`,
      ];

      if (assignmentCode) {
        patterns.push(`user:${userId}:submissions:${assignmentCode}`);
        patterns.push(`assignment:${assignmentCode}`);
      }

      await Promise.all(patterns.map(pattern => this.delPattern(pattern)));
    } catch (error) {
      logger.error('User submissions cache invalidation error:', { userId, assignmentCode, error });
    }
  }

  async invalidateFeedback(submissionId: string, userId: string): Promise<void> {
    try {
      await Promise.all([
        this.del(`feedback:${submissionId}`),
        this.delPattern(`user:${userId}:*`),
      ]);
    } catch (error) {
      logger.error('Feedback cache invalidation error:', { submissionId, userId, error });
    }
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return { status: 'healthy', latency };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return { status: 'unhealthy' };
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        memory: info,
        keyspace: keyspace,
        connected: this.redis.status === 'ready',
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return { connected: false };
    }
  }
}