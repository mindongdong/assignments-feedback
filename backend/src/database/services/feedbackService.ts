/**
 * Feedback service with AI integration and Korean language support
 * Optimized for Discord bot sub-100ms response times
 */

import { Feedback, FeedbackType, Prisma } from '@prisma/client';
import { prisma } from '../client';
import { cache, DiscordCache } from '../cache';
import { logger, PerformanceLogger } from '../../utils/logger';
import SubmissionService from './submissionService';
import type {
  FeedbackWithDetails,
  CreateFeedbackData,
  UpdateFeedbackData,
} from '../types';
import { FeedbackInclude } from '../types';

export class FeedbackService {
  /**
   * Create AI feedback for submission
   */
  static async createFeedback(data: CreateFeedbackData): Promise<Feedback | null> {
    const perf = new PerformanceLogger('createFeedback');

    try {
      // Check if feedback already exists
      const existingFeedback = await prisma.feedback.findUnique({
        where: { submissionId: data.submissionId },
      });

      if (existingFeedback) {
        throw new Error('이미 피드백이 존재합니다');
      }

      // Generate cache key for similar submissions
      const cacheKey = this.generateFeedbackCacheKey(data.aiFeedback, data.aiScore);

      const feedback = await prisma.feedback.create({
        data: {
          ...data,
          cacheKey,
          language: data.language || 'ko',
        },
      });

      // Update submission status
      await SubmissionService.updateStatus(data.submissionId, 'COMPLETED');

      // Cache the feedback
      await DiscordCache.setFeedback(data.submissionId, feedback);

      // Update performance log
      if (data.processingTime) {
        await prisma.performanceLog.create({
          data: {
            operation: 'ai_feedback_generation',
            executionTime: data.processingTime,
            success: true,
            metadata: {
              model: data.aiModel,
              tokensUsed: data.aiTokensUsed,
              language: data.language,
            },
          },
        });
      }

      logger.info(`AI 피드백 생성 완료: ${data.submissionId}`);
      perf.end();

      return feedback;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`피드백 생성 실패 (${data.submissionId}):`, error);
      
      // Update submission status to failed
      await SubmissionService.updateStatus(data.submissionId, 'FAILED', 
        error instanceof Error ? error.message : 'Unknown error');
      
      return null;
    }
  }

  /**
   * Get feedback by submission ID with caching
   */
  static async getBySubmissionId(submissionId: string): Promise<FeedbackWithDetails | null> {
    const perf = new PerformanceLogger('getFeedbackBySubmissionId');

    try {
      // Try cache first
      let feedback = await DiscordCache.getFeedback(submissionId);

      if (!feedback) {
        feedback = await prisma.feedback.findUnique({
          where: { submissionId },
          include: {
            submission: {
              include: {
                user: {
                  select: { discordId: true, username: true },
                },
                assignment: {
                  select: { title: true, assignmentCode: true },
                },
              },
            },
          },
        });

        if (feedback) {
          await DiscordCache.setFeedback(submissionId, feedback);
        }
      }

      perf.end();
      return feedback;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`피드백 조회 실패 (${submissionId}):`, error);
      return null;
    }
  }

  /**
   * Update feedback with manual content
   */
  static async updateFeedback(
    submissionId: string, 
    data: UpdateFeedbackData
  ): Promise<Feedback | null> {
    const perf = new PerformanceLogger('updateFeedback');

    try {
      const feedback = await prisma.feedback.update({
        where: { submissionId },
        data: {
          ...data,
          feedbackType: data.manualFeedback ? FeedbackType.HYBRID : FeedbackType.AI,
          updatedAt: new Date(),
        },
      });

      // Update cache
      await DiscordCache.setFeedback(submissionId, feedback);

      logger.info(`피드백 업데이트: ${submissionId}`);
      perf.end();

      return feedback;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`피드백 업데이트 실패 (${submissionId}):`, error);
      return null;
    }
  }

  /**
   * Get feedback statistics
   */
  static async getFeedbackStats() {
    const perf = new PerformanceLogger('getFeedbackStats');

    try {
      const cacheKey = 'stats:feedback:overview';
      
      let stats = await cache.get(cacheKey, 'discord:');

      if (!stats) {
        const [
          totalFeedbacks,
          aiFeedbacks,
          manualFeedbacks,
          hybridFeedbacks,
          avgProcessingTime,
          totalTokensUsed,
        ] = await Promise.all([
          prisma.feedback.count(),
          prisma.feedback.count({ where: { feedbackType: FeedbackType.AI } }),
          prisma.feedback.count({ where: { feedbackType: FeedbackType.MANUAL } }),
          prisma.feedback.count({ where: { feedbackType: FeedbackType.HYBRID } }),
          prisma.feedback.aggregate({
            _avg: { processingTime: true },
            where: { processingTime: { not: null } },
          }),
          prisma.feedback.aggregate({
            _sum: { aiTokensUsed: true },
            where: { aiTokensUsed: { not: null } },
          }),
        ]);

        // Get average scores
        const feedbacksWithScores = await prisma.feedback.findMany({
          select: { aiScore: true },
          where: { 
            aiScore: { 
              not: Prisma.DbNull 
            } 
          },
        });

        const scores = feedbacksWithScores
          .map(f => f.aiScore)
          .filter(score => score && typeof score === 'object' && 'overall' in score)
          .map(score => (score as any).overall);

        const averageScore = scores.length > 0 ? 
          scores.reduce((a, b) => a + b, 0) / scores.length : null;

        stats = {
          totalFeedbacks,
          aiFeedbacks,
          manualFeedbacks,
          hybridFeedbacks,
          averageProcessingTime: avgProcessingTime._avg.processingTime || null,
          totalTokensUsed: totalTokensUsed._sum.aiTokensUsed || 0,
          averageScore: averageScore ? Math.round(averageScore * 10) / 10 : null,
          aiPercentage: totalFeedbacks > 0 ? 
            ((aiFeedbacks / totalFeedbacks) * 100).toFixed(1) + '%' : '0%',
        };

        // Cache for 10 minutes
        await cache.set(cacheKey, stats, {
          ttl: 600,
          prefix: 'discord:',
        });
      }

      perf.end();
      return stats;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('피드백 통계 조회 실패:', error);
      return null;
    }
  }

  /**
   * Get recent feedbacks for admin dashboard
   */
  static async getRecentFeedbacks(limit: number = 20): Promise<FeedbackWithDetails[]> {
    const perf = new PerformanceLogger('getRecentFeedbacks');

    try {
      const cacheKey = `feedbacks:recent:${limit}`;
      
      let feedbacks = await cache.get<FeedbackWithDetails[]>(cacheKey, 'discord:');

      if (!feedbacks) {
        const rawFeedbacks = await prisma.feedback.findMany({
          include: FeedbackInclude,
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        feedbacks = rawFeedbacks as FeedbackWithDetails[];

        // Cache for 5 minutes
        await cache.set(cacheKey, feedbacks, {
          ttl: 300,
          prefix: 'discord:',
        });
      }

      perf.end();
      return feedbacks;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');  
      logger.error('최근 피드백 조회 실패:', error);
      return [];
    }
  }

  /**
   * Search feedbacks by content (Korean text search)
   */
  static async searchFeedbacks(query: string, limit: number = 10): Promise<FeedbackWithDetails[]> {
    const perf = new PerformanceLogger('searchFeedbacks');

    try {
      const rawFeedbacks = await prisma.feedback.findMany({
        where: {
          OR: [
            { aiFeedback: { search: query } },
            { manualFeedback: { search: query } },
          ],
        },
        include: FeedbackInclude,
        take: limit,
        orderBy: {
          _relevance: {
            fields: ['aiFeedback', 'manualFeedback'],
            search: query,
            sort: 'desc',
          },
        },
      });

      const feedbacks = rawFeedbacks as FeedbackWithDetails[];

      perf.end();
      return feedbacks;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`피드백 검색 실패 (${query}):`, error);
      return [];
    }
  }

  /**
   * Get feedbacks by assignment for analysis
   */
  static async getFeedbacksByAssignment(assignmentCode: string): Promise<FeedbackWithDetails[]> {
    const perf = new PerformanceLogger('getFeedbacksByAssignment');

    try {
      const cacheKey = `feedbacks:assignment:${assignmentCode}`;
      
      let feedbacks = await cache.get<FeedbackWithDetails[]>(cacheKey, 'discord:');

      if (!feedbacks) {
        const rawFeedbacks = await prisma.feedback.findMany({
          where: {
            submission: {
              assignmentCode,
            },
          },
          include: FeedbackInclude,
          orderBy: { createdAt: 'desc' },
        });

        feedbacks = rawFeedbacks as FeedbackWithDetails[];

        // Cache for 30 minutes
        await cache.set(cacheKey, feedbacks, {
          ttl: 1800,
          prefix: 'discord:',
        });
      }

      perf.end();
      return feedbacks;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`과제별 피드백 조회 실패 (${assignmentCode}):`, error);
      return [];
    }
  }

  /**
   * Get cached feedback by similarity (for optimization)
   */
  static async getCachedSimilarFeedback(
    submissionContent: string,
    assignmentCode: string
  ): Promise<Feedback | null> {
    try {
      // Generate content hash for similarity matching
      const contentHash = this.generateContentHash(submissionContent);
      
      // Look for cached feedback with similar content
      const similarFeedback = await prisma.feedback.findFirst({
        where: {
          cacheKey: {
            contains: contentHash.substring(0, 10), // Partial match
          },
          submission: {
            assignmentCode,
          },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Within 7 days
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return similarFeedback;
    } catch (error) {
      logger.debug('캐시된 유사 피드백 조회 실패:', error);
      return null;
    }
  }

  /**
   * Delete feedback
   */
  static async deleteFeedback(submissionId: string): Promise<boolean> {
    const perf = new PerformanceLogger('deleteFeedback');

    try {
      await prisma.feedback.delete({
        where: { submissionId },
      });

      // Remove from cache
      await cache.delete(`feedback:${submissionId}`, 'discord:');

      // Update submission status back to pending
      await SubmissionService.updateStatus(submissionId, 'PENDING');

      logger.info(`피드백 삭제: ${submissionId}`);
      perf.end();

      return true;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`피드백 삭제 실패 (${submissionId}):`, error);
      return false;
    }
  }

  /**
   * Generate cache key for feedback optimization
   */
  private static generateFeedbackCacheKey(feedback: string, score: any): string {
    const contentHash = this.generateContentHash(feedback);
    const scoreHash = this.generateContentHash(JSON.stringify(score));
    return `${contentHash.substring(0, 8)}_${scoreHash.substring(0, 8)}`;
  }

  /**
   * Generate content hash for similarity matching
   */
  private static generateContentHash(content: string): string {
    // Simple hash function for content similarity
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get feedback performance metrics
   */
  static async getPerformanceMetrics(days: number = 7) {
    const perf = new PerformanceLogger('getFeedbackPerformanceMetrics');

    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const metrics = await prisma.performanceLog.findMany({
        where: {
          operation: 'ai_feedback_generation',
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalRequests = metrics.length;
      const successfulRequests = metrics.filter(m => m.success).length;
      const avgExecutionTime = totalRequests > 0 ? 
        metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalRequests : 0;

      const result = {
        totalRequests,
        successfulRequests,
        successRate: totalRequests > 0 ? ((successfulRequests / totalRequests) * 100).toFixed(1) + '%' : '0%',
        avgExecutionTime: Math.round(avgExecutionTime),
        errors: metrics.filter(m => !m.success).length,
      };

      perf.end();
      return result;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('피드백 성능 메트릭 조회 실패:', error);
      return null;
    }
  }
}

export default FeedbackService;