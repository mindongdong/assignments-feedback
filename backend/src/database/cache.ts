/**
 * Redis caching service optimized for Discord bot performance
 * Provides sub-100ms response times with intelligent cache strategies
 */

import { redis } from './client';
import { logger } from '../utils/logger';

export interface CacheConfig {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Enable compression for large payloads
  prefix?: string; // Cache key prefix
}

export class CacheService {
  private readonly defaultTTL = 300; // 5 minutes default
  private readonly keyPrefix = 'discord-assignments:';

  /**
   * Generate cache key with prefix and namespace
   */
  private generateKey(key: string, prefix?: string): string {
    const actualPrefix = prefix || this.keyPrefix;
    return `${actualPrefix}${key}`;
  }

  /**
   * Set cache value with optional configuration
   */
  async set<T>(
    key: string, 
    value: T, 
    config: CacheConfig = {}
  ): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, config.prefix);
      const ttl = config.ttl || this.defaultTTL;
      
      let serializedValue = JSON.stringify(value);
      
      // Compress large payloads (>1KB) for Korean text efficiency
      if (config.compress && serializedValue.length > 1024) {
        const zlib = await import('zlib');
        serializedValue = zlib.gzipSync(serializedValue).toString('base64');
        await redis.setex(`${cacheKey}:compressed`, ttl, serializedValue);
      } else {
        await redis.setex(cacheKey, ttl, serializedValue);
      }

      // Update cache statistics
      await this.updateCacheStats('set', key);
      
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache value with automatic decompression
   */
  async get<T>(key: string, prefix?: string): Promise<T | null> {
    try {
      const cacheKey = this.generateKey(key, prefix);
      
      // Try compressed version first
      let value = await redis.get(`${cacheKey}:compressed`);
      let isCompressed = false;
      
      if (value) {
        isCompressed = true;
      } else {
        value = await redis.get(cacheKey);
      }

      if (!value) {
        await this.updateCacheStats('miss', key);
        return null;
      }

      // Decompress if needed
      let parsedValue: string = value;
      if (isCompressed) {
        const zlib = await import('zlib');
        parsedValue = zlib.gunzipSync(Buffer.from(value, 'base64')).toString();
      }

      await this.updateCacheStats('hit', key);
      return JSON.parse(parsedValue) as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      await this.updateCacheStats('error', key);
      return null;
    }
  }

  /**
   * Delete cache key
   */
  async delete(key: string, prefix?: string): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, prefix);
      
      // Delete both compressed and regular versions
      const deleted = await redis.del(cacheKey, `${cacheKey}:compressed`);
      
      await this.updateCacheStats('delete', key);
      return deleted > 0;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if cache key exists
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, prefix);
      const exists = await redis.exists(cacheKey) || await redis.exists(`${cacheKey}:compressed`);
      return exists > 0;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple cache values efficiently
   */
  async mget<T>(keys: string[], prefix?: string): Promise<(T | null)[]> {
    try {
      const cacheKeys = keys.map(key => this.generateKey(key, prefix));
      const values = await redis.mget(...cacheKeys);
      
      return Promise.all(
        values.map(async (value, index) => {
          if (!value) {
            await this.updateCacheStats('miss', keys[index]);
            return null;
          }
          
          await this.updateCacheStats('hit', keys[index]);
          return JSON.parse(value) as T;
        })
      );
    } catch (error) {
      logger.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple cache values efficiently
   */
  async mset<T>(
    keyValuePairs: Array<{ key: string; value: T }>,
    config: CacheConfig = {}
  ): Promise<boolean> {
    try {
      const ttl = config.ttl || this.defaultTTL;
      const pipeline = redis.pipeline();

      for (const { key, value } of keyValuePairs) {
        const cacheKey = this.generateKey(key, config.prefix);
        const serializedValue = JSON.stringify(value);
        pipeline.setex(cacheKey, ttl, serializedValue);
      }

      await pipeline.exec();
      
      // Update stats for all keys
      await Promise.all(
        keyValuePairs.map(({ key }) => this.updateCacheStats('set', key))
      );

      return true;
    } catch (error) {
      logger.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Update cache hit/miss statistics
   */
  private async updateCacheStats(operation: 'hit' | 'miss' | 'set' | 'delete' | 'error', key: string): Promise<void> {
    try {
      const statsKey = 'cache:stats';
      const today = new Date().toISOString().split('T')[0];
      
      await redis.hincrby(`${statsKey}:${today}`, operation, 1);
      await redis.hincrby(`${statsKey}:${today}`, 'total', 1);
      await redis.expire(`${statsKey}:${today}`, 86400 * 7); // Keep for 7 days
    } catch (error) {
      // Silent fail for stats - don't affect main operations
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(days: number = 1): Promise<Record<string, any>> {
    try {
      const stats: Record<string, any> = {};
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayStats = await redis.hgetall(`cache:stats:${dateStr}`);
        if (Object.keys(dayStats).length > 0) {
          stats[dateStr] = {
            ...dayStats,
            hitRate: dayStats.hit && dayStats.total 
              ? ((parseInt(dayStats.hit) / parseInt(dayStats.total)) * 100).toFixed(2) + '%'
              : '0%'
          };
        }
      }
      
      return stats;
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {};
    }
  }

  /**
   * Clear cache by pattern (use with caution)
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(this.generateKey(pattern));
      if (keys.length === 0) return 0;
      
      return await redis.del(...keys);
    } catch (error) {
      logger.error(`Cache clear pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Increment cache value (for counters)
   */
  async increment(key: string, by: number = 1, ttl?: number): Promise<number> {
    try {
      const cacheKey = this.generateKey(key);
      const newValue = await redis.incrby(cacheKey, by);
      
      if (ttl) {
        await redis.expire(cacheKey, ttl);
      }
      
      return newValue;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Add to cache list (for recent items, etc.)
   */
  async listPush(key: string, value: any, maxLength?: number, ttl?: number): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key);
      const serializedValue = JSON.stringify(value);
      
      await redis.lpush(cacheKey, serializedValue);
      
      if (maxLength) {
        await redis.ltrim(cacheKey, 0, maxLength - 1);
      }
      
      if (ttl) {
        await redis.expire(cacheKey, ttl);
      }
      
      return true;
    } catch (error) {
      logger.error(`Cache list push error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache list
   */
  async listGet<T>(key: string, start: number = 0, end: number = -1): Promise<T[]> {
    try {
      const cacheKey = this.generateKey(key);
      const values = await redis.lrange(cacheKey, start, end);
      
      return values.map(value => JSON.parse(value) as T);
    } catch (error) {
      logger.error(`Cache list get error for key ${key}:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const cache = new CacheService();

// Specialized cache functions for Discord operations
export class DiscordCache {
  static readonly USER_TTL = 3600; // 1 hour
  static readonly ASSIGNMENT_TTL = 1800; // 30 minutes
  static readonly SUBMISSION_TTL = 900; // 15 minutes
  static readonly FEEDBACK_TTL = 7200; // 2 hours

  /**
   * Cache user data by Discord ID
   */
  static async setUser(discordId: string, userData: any): Promise<boolean> {
    return cache.set(`user:${discordId}`, userData, { 
      ttl: this.USER_TTL,
      prefix: 'discord:'
    });
  }

  static async getUser(discordId: string): Promise<any | null> {
    return cache.get(`user:${discordId}`, 'discord:');
  }

  /**
   * Cache assignment data by code
   */
  static async setAssignment(assignmentCode: string, assignmentData: any): Promise<boolean> {
    return cache.set(`assignment:${assignmentCode}`, assignmentData, {
      ttl: this.ASSIGNMENT_TTL,
      prefix: 'discord:'
    });
  }

  static async getAssignment(assignmentCode: string): Promise<any | null> {
    return cache.get(`assignment:${assignmentCode}`, 'discord:');
  }

  /**
   * Cache user submissions for quick lookup
   */
  static async setUserSubmissions(discordId: string, submissions: any[]): Promise<boolean> {
    return cache.set(`user:${discordId}:submissions`, submissions, {
      ttl: this.SUBMISSION_TTL,
      prefix: 'discord:'
    });
  }

  static async getUserSubmissions(discordId: string): Promise<any[] | null> {
    return cache.get(`user:${discordId}:submissions`, 'discord:');
  }

  /**
   * Cache feedback data
   */
  static async setFeedback(submissionId: string, feedbackData: any): Promise<boolean> {
    return cache.set(`feedback:${submissionId}`, feedbackData, {
      ttl: this.FEEDBACK_TTL,
      prefix: 'discord:',
      compress: true // Feedback can be large
    });
  }

  static async getFeedback(submissionId: string): Promise<any | null> {
    return cache.get(`feedback:${submissionId}`, 'discord:');
  }

  /**
   * Cache assignment list for quick access
   */
  static async setAssignmentList(assignments: any[]): Promise<boolean> {
    return cache.set('assignments:active', assignments, {
      ttl: this.ASSIGNMENT_TTL,
      prefix: 'discord:'
    });
  }

  static async getAssignmentList(): Promise<any[] | null> {
    return cache.get('assignments:active', 'discord:');
  }
}

export default { cache, DiscordCache };