/**
 * Submission service optimized for Discord bot performance
 * Handles Korean content and GitHub/blog link processing
 */

import { Submission, SubmissionType, SubmissionStatus, Prisma } from '@prisma/client';
import { prisma } from '../client';
import { cache, DiscordCache } from '../cache';
import { logger, PerformanceLogger } from '../../utils/logger';
import UserService from './userService';
import AssignmentService from './assignmentService';
import type {
  SubmissionWithDetails,
  CreateSubmissionData,
  SubmissionFilter,
} from '../types';
import { SubmissionInclude } from '../types';

export class SubmissionService {
  /**
   * Create new submission with validation
   */
  static async createSubmission(data: CreateSubmissionData): Promise<Submission | null> {
    const perf = new PerformanceLogger('createSubmission', data.discordId);

    try {
      // Get user by Discord ID
      const user = await UserService.getByDiscordId(data.discordId);
      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다');
      }

      // Validate assignment exists and is active
      const assignment = await AssignmentService.getByCode(data.assignmentCode);
      if (!assignment) {
        throw new Error('과제를 찾을 수 없습니다');
      }
      
      if (!assignment.isActive) {
        throw new Error('비활성화된 과제입니다');
      }

      if (assignment.deadline < new Date()) {
        throw new Error('마감 기한이 지난 과제입니다');
      }

      // Check if user already has maximum submissions for this assignment
      const existingSubmissions = await prisma.submission.count({
        where: {
          assignmentCode: data.assignmentCode,
          userId: user.id,
        },
      });

      const maxSubmissions = assignment.maxSubmissions || 1;
      if (existingSubmissions >= maxSubmissions) {
        throw new Error(`이 과제는 최대 ${maxSubmissions}회까지만 제출할 수 있습니다`);
      }

      // Determine attempt number
      const attemptNumber = existingSubmissions + 1;

      // Create submission
      const rawSubmission = await prisma.submission.create({
        data: {
          assignmentCode: data.assignmentCode,
          userId: user.id,
          submissionType: data.submissionType,
          url: data.url,
          title: data.title,
          content: data.content,
          language: data.language,
          attemptNumber,
          status: SubmissionStatus.PENDING,
          metadata: data.metadata,
        },
        include: SubmissionInclude,
      });

      const submission = rawSubmission as SubmissionWithDetails;

      // Update user stats
      await UserService.updateUserStats(user.id);

      // Update assignment stats
      await AssignmentService.updateAssignmentStats(data.assignmentCode);

      // Invalidate user submission cache
      await cache.delete(`user:${data.discordId}:submissions`, 'discord:');

      logger.info(
        `새 제출물: ${user.username} -> ${assignment.title} (${data.assignmentCode})`
      );
      perf.end();

      return submission;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('제출물 생성 실패:', error);
      throw error;
    }
  }

  /**
   * Get submission by ID with details
   */
  static async getById(submissionId: string): Promise<SubmissionWithDetails | null> {
    const perf = new PerformanceLogger('getSubmissionById');

    try {
      const rawSubmission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: SubmissionInclude,
      });

      const submission = rawSubmission as SubmissionWithDetails | null;

      perf.end();
      return submission;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`제출물 조회 실패 (${submissionId}):`, error);
      return null;
    }
  }

  /**
   * Get user submissions with caching
   */
  static async getUserSubmissions(
    discordId: string,
    assignmentCode?: string
  ): Promise<SubmissionWithDetails[]> {
    const perf = new PerformanceLogger('getUserSubmissions', discordId);

    try {
      const cacheKey = assignmentCode 
        ? `user:${discordId}:submissions:${assignmentCode}`
        : `user:${discordId}:submissions`;

      // Try cache first
      let submissions = await cache.get<SubmissionWithDetails[]>(cacheKey, 'discord:');

      if (!submissions) {
        const user = await UserService.getByDiscordId(discordId);
        if (!user) {
          return [];
        }

        const where: Prisma.SubmissionWhereInput = {
          userId: user.id,
          ...(assignmentCode && { assignmentCode }),
        };

        const rawSubmissions = await prisma.submission.findMany({
          where,
          include: SubmissionInclude,
          orderBy: { submittedAt: 'desc' },
        });

        submissions = rawSubmissions as SubmissionWithDetails[];

        // Cache for 15 minutes
        await cache.set(cacheKey, submissions, {
          ttl: DiscordCache.SUBMISSION_TTL,
          prefix: 'discord:',
        });
      }

      perf.end();
      return submissions;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`사용자 제출물 조회 실패 (${discordId}):`, error);
      return [];
    }
  }

  /**
   * Get assignment submissions for admin
   */
  static async getAssignmentSubmissions(
    assignmentCode: string,
    filter: SubmissionFilter = {}
  ): Promise<SubmissionWithDetails[]> {
    const perf = new PerformanceLogger('getAssignmentSubmissions');

    try {
      const where: Prisma.SubmissionWhereInput = {
        assignmentCode,
        ...(filter.status && { status: filter.status }),
        ...(filter.submissionType && { submissionType: filter.submissionType }),
        ...(filter.dateFrom && { submittedAt: { gte: filter.dateFrom } }),
        ...(filter.dateTo && { submittedAt: { lte: filter.dateTo } }),
      };

      const rawSubmissions = await prisma.submission.findMany({
        where,
        include: SubmissionInclude,
        orderBy: { submittedAt: 'desc' },
      });

      const submissions = rawSubmissions as SubmissionWithDetails[];

      perf.end();
      return submissions;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`과제 제출물 조회 실패 (${assignmentCode}):`, error);
      return [];
    }
  }

  /**
   * Get pending submissions for processing
   */
  static async getPendingSubmissions(limit: number = 10): Promise<Submission[]> {
    const perf = new PerformanceLogger('getPendingSubmissions');

    try {
      const submissions = await prisma.submission.findMany({
        where: {
          status: SubmissionStatus.PENDING,
          assignment: {
            isActive: true,
            autoFeedback: true,
          },
        },
        include: {
          assignment: {
            select: { title: true, requirements: true, recommendations: true },
          },
        },
        orderBy: { submittedAt: 'asc' },
        take: limit,
      });

      perf.end();
      return submissions;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('대기 제출물 조회 실패:', error);
      return [];
    }
  }

  /**
   * Update submission status
   */
  static async updateStatus(
    submissionId: string,
    status: SubmissionStatus,
    errorMessage?: string
  ): Promise<boolean> {
    const perf = new PerformanceLogger('updateSubmissionStatus');

    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status,
          ...(errorMessage && { errorMessage }),
          ...(status === SubmissionStatus.PROCESSING && { processedAt: new Date() }),
        },
      });

      // Invalidate related caches
      const submission = await this.getById(submissionId);
      if (submission?.user?.discordId) {
        await cache.delete(`user:${submission.user.discordId}:submissions`, 'discord:');
      }

      perf.end();
      return true;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`제출물 상태 업데이트 실패 (${submissionId}):`, error);
      return false;
    }
  }

  /**
   * Check if user has submitted for assignment
   */
  static async hasUserSubmitted(discordId: string, assignmentCode: string): Promise<boolean> {
    try {
      const user = await UserService.getByDiscordId(discordId);
      if (!user) return false;

      const count = await prisma.submission.count({
        where: {
          userId: user.id,
          assignmentCode,
        },
      });

      return count > 0;
    } catch (error) {
      logger.error(`제출 여부 확인 실패 (${discordId}, ${assignmentCode}):`, error);
      return false;
    }
  }

  /**
   * Get user's latest submission for assignment
   */
  static async getLatestUserSubmission(
    discordId: string,
    assignmentCode: string
  ): Promise<SubmissionWithDetails | null> {
    const perf = new PerformanceLogger('getLatestUserSubmission', discordId);

    try {
      const user = await UserService.getByDiscordId(discordId);
      if (!user) return null;

      const rawSubmission = await prisma.submission.findFirst({
        where: {
          userId: user.id,
          assignmentCode,
        },
        include: SubmissionInclude,
        orderBy: { submittedAt: 'desc' },
      });

      const submission = rawSubmission as SubmissionWithDetails | null;

      perf.end();
      return submission;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`최신 제출물 조회 실패 (${discordId}, ${assignmentCode}):`, error);
      return null;
    }
  }

  /**
   * Get recent submissions for dashboard
   */
  static async getRecentSubmissions(limit: number = 20): Promise<SubmissionWithDetails[]> {
    const perf = new PerformanceLogger('getRecentSubmissions');

    try {
      const cacheKey = `submissions:recent:${limit}`;
      
      let submissions = await cache.get<SubmissionWithDetails[]>(cacheKey, 'discord:');

      if (!submissions) {
        const rawSubmissions = await prisma.submission.findMany({
          include: SubmissionInclude,
          orderBy: { submittedAt: 'desc' },
          take: limit,
        });

        submissions = rawSubmissions as SubmissionWithDetails[];

        // Cache for 5 minutes
        await cache.set(cacheKey, submissions, {
          ttl: 300,
          prefix: 'discord:',
        });
      }

      perf.end();
      return submissions;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('최근 제출물 조회 실패:', error);
      return [];
    }
  }

  /**
   * Get submission statistics
   */
  static async getSubmissionStats() {
    const perf = new PerformanceLogger('getSubmissionStats');

    try {
      const cacheKey = 'stats:submissions:overview';
      
      let stats = await cache.get(cacheKey, 'discord:');

      if (!stats) {
        const [
          totalSubmissions,
          pendingSubmissions,
          completedSubmissions,
          failedSubmissions,
          todaySubmissions,
        ] = await Promise.all([
          prisma.submission.count(),
          prisma.submission.count({ where: { status: SubmissionStatus.PENDING } }),
          prisma.submission.count({ where: { status: SubmissionStatus.COMPLETED } }),
          prisma.submission.count({ where: { status: SubmissionStatus.FAILED } }),
          prisma.submission.count({
            where: {
              submittedAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          }),
        ]);

        stats = {
          totalSubmissions,
          pendingSubmissions,
          completedSubmissions,
          failedSubmissions,
          todaySubmissions,
          completionRate: totalSubmissions > 0 
            ? ((completedSubmissions / totalSubmissions) * 100).toFixed(1) + '%'
            : '0%',
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
      logger.error('제출물 통계 조회 실패:', error);
      return null;
    }
  }

  /**
   * Delete submission (admin only)
   */
  static async deleteSubmission(submissionId: string): Promise<boolean> {
    const perf = new PerformanceLogger('deleteSubmission');

    try {
      // Get submission details for cache invalidation
      const submission = await this.getById(submissionId);
      
      // Delete submission and related feedback
      await prisma.submission.delete({
        where: { id: submissionId },
      });

      // Invalidate caches
      if (submission?.user?.discordId) {
        await cache.delete(`user:${submission.user.discordId}:submissions`, 'discord:');
      }
      
      if (submission?.assignmentCode) {
        await AssignmentService.updateAssignmentStats(submission.assignmentCode);
      }

      logger.info(`제출물 삭제: ${submissionId}`);
      perf.end();

      return true;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`제출물 삭제 실패 (${submissionId}):`, error);
      return false;
    }
  }
}

export default SubmissionService;