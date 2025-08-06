/**
 * Assignment service with Redis caching and Korean language support
 * Optimized for Discord bot sub-100ms response times
 */

import { Assignment, Prisma, Difficulty } from '@prisma/client';
import { prisma } from '../client';
import { cache, DiscordCache } from '../cache';
import { logger, PerformanceLogger } from '../../utils/logger';
import { generateAssignmentCode } from '../../utils/assignmentCode';
import type {
  AssignmentWithStats,
  CreateAssignmentData,
  AssignmentFilter,
} from '../types';
import { AssignmentInclude } from '../types';

export class AssignmentService {
  /**
   * Create new assignment with unique 6-character code
   */
  static async createAssignment(data: CreateAssignmentData): Promise<Assignment> {
    const perf = new PerformanceLogger('createAssignment');
    
    try {
      let assignmentCode: string;
      let attempts = 0;
      const maxAttempts = 10;

      // Generate unique assignment code
      do {
        assignmentCode = generateAssignmentCode();
        attempts++;
        
        if (attempts > maxAttempts) {
          throw new Error('Unable to generate unique assignment code after multiple attempts');
        }
      } while (await this.existsByCode(assignmentCode));

      const assignment = await prisma.assignment.create({
        data: {
          assignmentCode,
          ...data,
        },
      });

      // Initialize assignment stats
      await prisma.assignmentStats.create({
        data: {
          assignmentCode: assignment.assignmentCode,
        },
      });

      // Cache the new assignment
      await DiscordCache.setAssignment(assignment.assignmentCode, assignment);

      // Invalidate assignment list cache
      await cache.delete('assignments:active', 'discord:');

      logger.info(`새 과제 생성: ${assignment.title} (${assignment.assignmentCode})`);
      perf.end();

      return assignment;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('과제 생성 실패:', error);
      throw error;
    }
  }

  /**
   * Get assignment by code with caching
   */
  static async getByCode(assignmentCode: string): Promise<Assignment | null> {
    const perf = new PerformanceLogger('getAssignmentByCode');

    try {
      // Try cache first
      let assignment = await DiscordCache.getAssignment(assignmentCode);
      
      if (!assignment) {
        // Fetch from database
        assignment = await prisma.assignment.findUnique({
          where: { assignmentCode },
          include: {
            assignmentStats: true,
          },
        });

        if (assignment) {
          // Cache for future requests
          await DiscordCache.setAssignment(assignmentCode, assignment);
        }
      }

      perf.end();
      return assignment;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`과제 조회 실패 (${assignmentCode}):`, error);
      return null;
    }
  }

  /**
   * Get active assignments with optional filtering
   */
  static async getActiveAssignments(filter: AssignmentFilter = {}): Promise<AssignmentWithStats[]> {
    const perf = new PerformanceLogger('getActiveAssignments');

    try {
      // Generate cache key based on filter
      const cacheKey = `assignments:filtered:${JSON.stringify(filter)}`;
      
      // Try cache first
      let assignments = await cache.get<AssignmentWithStats[]>(cacheKey, 'discord:');
      
      if (!assignments) {
        const where: Prisma.AssignmentWhereInput = {
          isActive: filter.isActive ?? true,
          ...(filter.category && { category: filter.category }),
          ...(filter.difficulty && { difficulty: filter.difficulty }),
          ...(filter.deadlineAfter && { deadline: { gte: filter.deadlineAfter } }),
          ...(filter.deadlineBefore && { deadline: { lte: filter.deadlineBefore } }),
          ...(filter.search && {
            OR: [
              { title: { search: filter.search } },
              { description: { search: filter.search } },
            ],
          }),
        };

        const rawAssignments = await prisma.assignment.findMany({
          where,
          include: AssignmentInclude,
          orderBy: [
            { deadline: 'asc' },
            { createdAt: 'desc' },
          ],
        });

        assignments = rawAssignments;

        // Transform to include computed stats
        const assignmentsWithStats: AssignmentWithStats[] = assignments.map((assignment: any) => ({
          ...assignment,
          submissionCount: assignment._count?.submissions || 0,
          averageScore: assignment.assignmentStats?.averageScore || null,
          completionRate: assignment.assignmentStats?.completionRate || null,
        }));

        // Cache results
        await cache.set(cacheKey, assignmentsWithStats, {
          ttl: DiscordCache.ASSIGNMENT_TTL,
          prefix: 'discord:',
        });

        assignments = assignmentsWithStats;
      }

      perf.end();
      return assignments;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('활성 과제 목록 조회 실패:', error);
      return [];
    }
  }

  /**
   * Get assignments approaching deadline
   */
  static async getAssignmentsNearDeadline(hoursUntilDeadline: number = 24): Promise<Assignment[]> {
    const perf = new PerformanceLogger('getAssignmentsNearDeadline');

    try {
      const cacheKey = `assignments:near-deadline:${hoursUntilDeadline}h`;
      
      let assignments = await cache.get<Assignment[]>(cacheKey, 'discord:');
      
      if (!assignments) {
        const deadlineThreshold = new Date();
        deadlineThreshold.setHours(deadlineThreshold.getHours() + hoursUntilDeadline);

        assignments = await prisma.assignment.findMany({
          where: {
            isActive: true,
            deadline: {
              gte: new Date(),
              lte: deadlineThreshold,
            },
          },
          orderBy: { deadline: 'asc' },
        });

        // Cache for 1 hour
        await cache.set(cacheKey, assignments, {
          ttl: 3600,
          prefix: 'discord:',
        });
      }

      perf.end();
      return assignments;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('마감 임박 과제 조회 실패:', error);
      return [];
    }
  }

  /**
   * Update assignment
   */
  static async updateAssignment(
    assignmentCode: string, 
    data: Partial<CreateAssignmentData>
  ): Promise<Assignment | null> {
    const perf = new PerformanceLogger('updateAssignment');

    try {
      const assignment = await prisma.assignment.update({
        where: { assignmentCode },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      // Update cache
      await DiscordCache.setAssignment(assignmentCode, assignment);

      // Invalidate related caches
      await cache.clearPattern('assignments:*');

      logger.info(`과제 업데이트: ${assignment.title} (${assignmentCode})`);
      perf.end();

      return assignment;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`과제 업데이트 실패 (${assignmentCode}):`, error);
      return null;
    }
  }

  /**
   * Deactivate assignment (soft delete)
   */
  static async deactivateAssignment(assignmentCode: string): Promise<boolean> {
    const perf = new PerformanceLogger('deactivateAssignment');

    try {
      await prisma.assignment.update({
        where: { assignmentCode },
        data: { isActive: false },
      });

      // Remove from cache
      await cache.delete(`assignment:${assignmentCode}`, 'discord:');

      // Invalidate assignment lists
      await cache.clearPattern('assignments:*');

      logger.info(`과제 비활성화: ${assignmentCode}`);
      perf.end();

      return true;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`과제 비활성화 실패 (${assignmentCode}):`, error);
      return false;
    }
  }

  /**
   * Check if assignment exists by code
   */
  static async existsByCode(assignmentCode: string): Promise<boolean> {
    try {
      // Check cache first
      if (await cache.exists(`assignment:${assignmentCode}`, 'discord:')) {
        return true;
      }

      // Check database
      const count = await prisma.assignment.count({
        where: { assignmentCode },
      });

      return count > 0;
    } catch (error) {
      logger.error(`과제 존재 확인 실패 (${assignmentCode}):`, error);
      return false;
    }
  }

  /**
   * Search assignments by title or content (Korean text search)
   */
  static async searchAssignments(query: string, limit: number = 10): Promise<Assignment[]> {
    const perf = new PerformanceLogger('searchAssignments');

    try {
      const cacheKey = `search:assignments:${query}:${limit}`;
      
      let assignments = await cache.get<Assignment[]>(cacheKey, 'discord:');
      
      if (!assignments) {
        assignments = await prisma.assignment.findMany({
          where: {
            isActive: true,
            OR: [
              { title: { search: query } },
              { description: { search: query } },
              { requirements: { search: query } },
            ],
          },
          take: limit,
          orderBy: {
            _relevance: {
              fields: ['title', 'description'],
              search: query,
              sort: 'desc',
            },
          },
        });

        // Cache search results for 5 minutes
        await cache.set(cacheKey, assignments, {
          ttl: 300,
          prefix: 'discord:',
        });
      }

      perf.end();
      return assignments;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`과제 검색 실패 (${query}):`, error);
      return [];
    }
  }

  /**
   * Get assignment statistics
   */
  static async getAssignmentStats(assignmentCode: string) {
    const perf = new PerformanceLogger('getAssignmentStats');

    try {
      const cacheKey = `stats:assignment:${assignmentCode}`;
      
      let stats = await cache.get(cacheKey, 'discord:');
      
      if (!stats) {
        const assignment = await prisma.assignment.findUnique({
          where: { assignmentCode },
          include: {
            assignmentStats: true,
            submissions: {
              include: {
                feedback: true,
              },
            },
          },
        });

        if (!assignment) {
          return null;
        }

        // Calculate real-time stats
        const totalSubmissions = assignment.submissions.length;
        const completedSubmissions = assignment.submissions.filter(s => s.feedback).length;
        const scores = assignment.submissions
          .map(s => s.feedback?.aiScore)
          .filter(score => score && typeof score === 'object' && 'overall' in score)
          .map(score => (score as any).overall);

        stats = {
          assignmentCode,
          title: assignment.title,
          totalSubmissions,
          completedSubmissions,
          completionRate: totalSubmissions > 0 ? (completedSubmissions / totalSubmissions) * 100 : 0,
          averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
          difficulty: assignment.difficulty,
          category: assignment.category,
          deadline: assignment.deadline,
          isActive: assignment.isActive,
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
      logger.error(`과제 통계 조회 실패 (${assignmentCode}):`, error);
      return null;
    }
  }

  /**
   * Update assignment statistics (called after submission changes)
   */
  static async updateAssignmentStats(assignmentCode: string): Promise<void> {
    try {
      // Invalidate stats cache
      await cache.delete(`stats:assignment:${assignmentCode}`, 'discord:');
      
      // Recalculate and cache stats
      await this.getAssignmentStats(assignmentCode);
      
      logger.info(`과제 통계 업데이트: ${assignmentCode}`);
    } catch (error) {
      logger.error(`과제 통계 업데이트 실패 (${assignmentCode}):`, error);
    }
  }
}

export default AssignmentService;