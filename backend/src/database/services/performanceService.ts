/**
 * Performance monitoring service for Discord bot optimization
 * Tracks sub-100ms response time requirements and Korean language processing
 */

import { PerformanceLog } from '@prisma/client';
import { prisma } from '../client';
import { cache } from '../cache';
import { logger, PerformanceLogger } from '../../utils/logger';
import type {
  PerformanceMetrics,
  DiscordCommandMetrics,
} from '../types';

export class PerformanceService {
  /**
   * Log Discord command performance
   */
  static async logDiscordCommand(
    command: string,
    executionTime: number,
    success: boolean,
    discordId?: string,
    errorType?: string,
    metadata?: any
  ): Promise<void> {
    try {
      await prisma.performanceLog.create({
        data: {
          operation: `discord_${command}`,
          executionTime,
          success,
          discordId,
          errorType,
          metadata,
        },
      });

      // Log slow commands immediately
      if (executionTime > 100) {
        logger.warn(`Slow Discord command: ${command} took ${executionTime}ms`, {
          discordId,
          metadata,
        });
      }

      // Update real-time metrics cache
      await this.updateCommandMetricsCache(command, executionTime, success);
    } catch (error) {
      // Silent fail for performance logging
      logger.debug('Performance logging failed:', error);
    }
  }

  /**
   * Get Discord command performance metrics
   */
  static async getDiscordCommandMetrics(
    hours: number = 24
  ): Promise<DiscordCommandMetrics[]> {
    const perf = new PerformanceLogger('getDiscordCommandMetrics');

    try {
      const cacheKey = `metrics:discord:commands:${hours}h`;
      
      let metrics = await cache.get<DiscordCommandMetrics[]>(cacheKey);

      if (!metrics) {
        const since = new Date();
        since.setHours(since.getHours() - hours);

        const rawMetrics = await prisma.performanceLog.groupBy({
          by: ['operation'],
          where: {
            operation: { startsWith: 'discord_' },
            createdAt: { gte: since },
          },
          _count: {
            operation: true,
          },
          _avg: {
            executionTime: true,
          },
          _max: {
            executionTime: true,
          },
          _min: {
            executionTime: true,
          },
        });

        // Get success counts and user counts separately
        const successCounts = await prisma.performanceLog.groupBy({
          by: ['operation'],
          where: {
            operation: { startsWith: 'discord_' },
            createdAt: { gte: since },
            success: true,
          },
          _count: {
            operation: true,
          },
        });

        const userCounts = await prisma.performanceLog.groupBy({
          by: ['operation'],
          where: {
            operation: { startsWith: 'discord_' },
            createdAt: { gte: since },
            discordId: { not: null },
          },
          _count: {
            discordId: true,
          },
        });

        // Transform to Discord command metrics
        metrics = rawMetrics.map(metric => {
          const command = metric.operation.replace('discord_', '');
          const successCount = successCounts.find(s => s.operation === metric.operation)?._count.operation || 0;
          const uniqueUsers = userCounts.find(u => u.operation === metric.operation)?._count.discordId || 0;
          
          return {
            command,
            totalUses: metric._count.operation,
            avgResponseTime: Math.round(metric._avg.executionTime || 0),
            successRate: metric._count.operation > 0 ? (successCount / metric._count.operation) * 100 : 0,
            userCount: uniqueUsers,
            popularityScore: this.calculatePopularityScore(
              metric._count.operation,
              uniqueUsers,
              metric._avg.executionTime || 0
            ),
          };
        }).sort((a, b) => b.popularityScore - a.popularityScore);

        // Cache for 5 minutes
        await cache.set(cacheKey, metrics, { ttl: 300 });
      }

      perf.end();
      return metrics;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('Discord 명령어 메트릭스 조회 실패:', error);
      return [];
    }
  }

  /**
   * Get overall system performance statistics
   */
  static async getSystemPerformance(hours: number = 24): Promise<any> {
    const perf = new PerformanceLogger('getSystemPerformance');

    try {
      const cacheKey = `metrics:system:performance:${hours}h`;
      
      let stats = await cache.get(cacheKey);

      if (!stats) {
        const since = new Date();
        since.setHours(since.getHours() - hours);

        const [
          totalOperations,
          successfulOperations,
          avgExecutionTime,
          slowOperations,
          discordOperations,
          uniqueUsers,
        ] = await Promise.all([
          prisma.performanceLog.count({
            where: { createdAt: { gte: since } },
          }),
          prisma.performanceLog.count({
            where: { 
              createdAt: { gte: since },
              success: true,
            },
          }),
          prisma.performanceLog.aggregate({
            _avg: { executionTime: true },
            where: { createdAt: { gte: since } },
          }),
          prisma.performanceLog.count({
            where: {
              createdAt: { gte: since },
              executionTime: { gt: 100 }, // Slow operations >100ms
            },
          }),
          prisma.performanceLog.count({
            where: {
              createdAt: { gte: since },
              operation: { startsWith: 'discord_' },
            },
          }),
          prisma.performanceLog.aggregate({
            _count: { discordId: true },
            where: {
              createdAt: { gte: since },
              discordId: { not: null },
            },
          }),
        ]);

        stats = {
          totalOperations,
          successfulOperations,
          successRate: totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0,
          avgExecutionTime: Math.round(avgExecutionTime._avg.executionTime || 0),
          slowOperations,
          slowOperationRate: totalOperations > 0 ? (slowOperations / totalOperations) * 100 : 0,
          discordOperations,
          discordOperationRate: totalOperations > 0 ? (discordOperations / totalOperations) * 100 : 0,
          uniqueUsers: uniqueUsers._count.discordId || 0,
          period: `${hours} hours`,
        };

        // Cache for 10 minutes
        await cache.set(cacheKey, stats, { ttl: 600 });
      }

      perf.end();
      return stats;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('시스템 성능 통계 조회 실패:', error);
      return null;
    }
  }

  /**
   * Get performance trends over time
   */
  static async getPerformanceTrends(days: number = 7): Promise<any[]> {
    const perf = new PerformanceLogger('getPerformanceTrends');

    try {
      const cacheKey = `metrics:trends:${days}d`;
      
      let trends = await cache.get<any[]>(cacheKey);

      if (!trends) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        // Get daily performance data
        const dailyStats = await prisma.$queryRaw`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_operations,
            COUNT(*) FILTER (WHERE success = true) as successful_operations,
            AVG(execution_time) as avg_execution_time,
            COUNT(*) FILTER (WHERE execution_time > 100) as slow_operations,
            COUNT(*) FILTER (WHERE operation LIKE 'discord_%') as discord_operations,
            COUNT(DISTINCT discord_id) FILTER (WHERE discord_id IS NOT NULL) as unique_users
          FROM performance_logs
          WHERE created_at >= ${since}
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at)
        `;

        trends = (dailyStats as any[]).map(stat => ({
          date: stat.date,
          totalOperations: Number(stat.total_operations),
          successfulOperations: Number(stat.successful_operations),
          successRate: Number(stat.total_operations) > 0 
            ? (Number(stat.successful_operations) / Number(stat.total_operations)) * 100 
            : 0,
          avgExecutionTime: Math.round(Number(stat.avg_execution_time) || 0),
          slowOperations: Number(stat.slow_operations),
          discordOperations: Number(stat.discord_operations),
          uniqueUsers: Number(stat.unique_users),
        }));

        // Cache for 1 hour
        await cache.set(cacheKey, trends, { ttl: 3600 });
      }

      perf.end();
      return trends;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('성능 트렌드 조회 실패:', error);
      return [];
    }
  }

  /**
   * Get error analysis
   */
  static async getErrorAnalysis(hours: number = 24): Promise<any> {
    const perf = new PerformanceLogger('getErrorAnalysis');

    try {
      const since = new Date();
      since.setHours(since.getHours() - hours);

      const errors = await prisma.performanceLog.groupBy({
        by: ['operation', 'errorType'],
        where: {
          createdAt: { gte: since },
          success: false,
          errorType: { not: null },
        },
        _count: {
          operation: true,
        },
        orderBy: {
          _count: {
            operation: 'desc',
          },
        },
      });

      const errorAnalysis = {
        totalErrors: errors.reduce((sum, error) => sum + error._count.operation, 0),
        errorsByOperation: {} as Record<string, Record<string, number>>,
        topErrors: errors.slice(0, 10).map(error => ({
          operation: error.operation,
          errorType: error.errorType,
          count: error._count.operation,
        })),
      };

      // Group errors by operation
      errors.forEach(error => {
        if (!errorAnalysis.errorsByOperation[error.operation]) {
          errorAnalysis.errorsByOperation[error.operation] = {};
        }
        errorAnalysis.errorsByOperation[error.operation][error.errorType!] = error._count.operation;
      });

      perf.end();
      return errorAnalysis;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('에러 분석 조회 실패:', error);
      return { totalErrors: 0, errorsByOperation: {}, topErrors: [] };
    }
  }

  /**
   * Get slowest operations
   */
  static async getSlowestOperations(limit: number = 10): Promise<any[]> {
    const perf = new PerformanceLogger('getSlowestOperations');

    try {
      const since = new Date();
      since.setHours(since.getHours() - 24);

      const slowOps = await prisma.performanceLog.groupBy({
        by: ['operation'],
        where: {
          createdAt: { gte: since },
          executionTime: { gt: 50 }, // Only operations slower than 50ms
        },
        _avg: {
          executionTime: true,
        },
        _max: {
          executionTime: true,
        },
        _count: {
          operation: true,
        },
        orderBy: {
          _avg: {
            executionTime: 'desc',
          },
        },
        take: limit,
      });

      const result = slowOps.map(op => ({
        operation: op.operation,
        avgExecutionTime: Math.round(op._avg.executionTime || 0),
        maxExecutionTime: op._max.executionTime || 0,
        occurrences: op._count.operation,
        impact: this.calculateImpactScore(
          op._avg.executionTime || 0,
          op._count.operation
        ),
      }));

      perf.end();
      return result;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('느린 작업 조회 실패:', error);
      return [];
    }
  }

  /**
   * Clean old performance logs (call periodically)
   */
  static async cleanOldLogs(daysToKeep: number = 30): Promise<number> {
    const perf = new PerformanceLogger('cleanOldLogs');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.performanceLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      logger.info(`성능 로그 정리 완료: ${result.count}개 삭제`);
      perf.end();

      return result.count;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('성능 로그 정리 실패:', error);
      return 0;
    }
  }

  /**
   * Update real-time command metrics cache
   */
  private static async updateCommandMetricsCache(
    command: string,
    executionTime: number,
    success: boolean
  ): Promise<void> {
    try {
      const cacheKey = `metrics:realtime:${command}`;
      
      let metrics: any = await cache.get(cacheKey) || {
        totalCalls: 0,
        successfulCalls: 0,
        totalTime: 0,
        maxTime: 0,
        minTime: Infinity,
      };

      metrics.totalCalls++;
      if (success) metrics.successfulCalls++;
      metrics.totalTime += executionTime;
      metrics.maxTime = Math.max(metrics.maxTime, executionTime);
      metrics.minTime = Math.min(metrics.minTime, executionTime);

      // Cache for 1 hour
      await cache.set(cacheKey, metrics, { ttl: 3600 });
    } catch (error) {
      // Silent fail for cache updates
    }
  }

  /**
   * Calculate popularity score for commands
   */
  private static calculatePopularityScore(
    totalUses: number,
    uniqueUsers: number,
    avgResponseTime: number
  ): number {
    // Weight: usage (50%), user adoption (30%), performance (20%)
    const usageScore = Math.min(totalUses / 10, 100); // Max 100 for 10+ uses
    const adoptionScore = Math.min(uniqueUsers / 5, 100); // Max 100 for 5+ users
    const performanceScore = Math.max(0, 100 - avgResponseTime); // Lower time = higher score
    
    return (usageScore * 0.5) + (adoptionScore * 0.3) + (performanceScore * 0.2);
  }

  /**
   * Calculate impact score for slow operations
   */
  private static calculateImpactScore(avgTime: number, occurrences: number): number {
    // Impact = average_time * occurrences / 1000 (normalized)
    return Math.round((avgTime * occurrences) / 1000);
  }

  /**
   * Get real-time performance alerts
   */
  static async getPerformanceAlerts(): Promise<any[]> {
    const alerts: any[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      // Check for high error rate
      const recentOps = await prisma.performanceLog.count({
        where: { createdAt: { gte: oneHourAgo } },
      });

      const recentErrors = await prisma.performanceLog.count({
        where: { 
          createdAt: { gte: oneHourAgo },
          success: false,
        },
      });

      const errorRate = recentOps > 0 ? (recentErrors / recentOps) * 100 : 0;

      if (errorRate > 10) {
        alerts.push({
          type: 'high_error_rate',
          severity: errorRate > 25 ? 'critical' : 'warning',
          message: `높은 오류율 감지: ${errorRate.toFixed(1)}%`,
          value: errorRate,
          threshold: 10,
        });
      }

      // Check for slow response times
      const avgTime = await prisma.performanceLog.aggregate({
        _avg: { executionTime: true },
        where: {
          createdAt: { gte: oneHourAgo },
          operation: { startsWith: 'discord_' },
        },
      });

      const avgResponseTime = avgTime._avg.executionTime || 0;

      if (avgResponseTime > 200) {
        alerts.push({
          type: 'slow_response_time',
          severity: avgResponseTime > 500 ? 'critical' : 'warning',
          message: `느린 응답 시간: ${Math.round(avgResponseTime)}ms`,
          value: avgResponseTime,
          threshold: 200,
        });
      }

      return alerts;
    } catch (error) {
      logger.error('성능 알림 확인 실패:', error);
      return [];
    }
  }
}

export default PerformanceService;