/**
 * User service optimized for Discord integration
 * Handles Korean usernames and activity tracking
 */

import { User, Prisma } from '@prisma/client';
import { prisma } from '../client';
import { cache, DiscordCache } from '../cache';
import { logger, PerformanceLogger } from '../../utils/logger';
import type {
  UserWithStats,
  CreateUserData,
  UpdateUserData,
  UserInclude,
} from '../types';

export class UserService {
  /**
   * Create or get user by Discord ID
   */
  static async createOrGetUser(data: CreateUserData): Promise<User> {
    const perf = new PerformanceLogger('createOrGetUser', data.discordId);

    try {
      // Try cache first
      let user = await DiscordCache.getUser(data.discordId);
      
      if (!user) {
        // Try to find existing user
        user = await prisma.user.findUnique({
          where: { discordId: data.discordId },
        });

        if (!user) {
          // Create new user
          user = await prisma.user.create({
            data: {
              ...data,
              lastSeenAt: new Date(),
            },
          });

          // Initialize user stats
          await prisma.userStats.create({
            data: {
              userId: user.id,
            },
          });

          logger.info(`새 사용자 생성: ${data.username} (${data.discordId})`);
        } else {
          // Update last seen
          user = await prisma.user.update({
            where: { id: user.id },
            data: { lastSeenAt: new Date() },
          });
        }

        // Cache the user
        await DiscordCache.setUser(data.discordId, user);
      }

      perf.end();
      return user;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`사용자 생성/조회 실패 (${data.discordId}):`, error);
      throw error;
    }
  }

  /**
   * Get user by Discord ID with caching
   */
  static async getByDiscordId(discordId: string): Promise<User | null> {
    const perf = new PerformanceLogger('getUserByDiscordId', discordId);

    try {
      // Try cache first
      let user = await DiscordCache.getUser(discordId);
      
      if (!user) {
        user = await prisma.user.findUnique({
          where: { discordId },
        });

        if (user) {
          await DiscordCache.setUser(discordId, user);
        }
      }

      perf.end();
      return user;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`사용자 조회 실패 (${discordId}):`, error);
      return null;
    }
  }

  /**
   * Get user with statistics
   */
  static async getUserWithStats(discordId: string): Promise<UserWithStats | null> {
    const perf = new PerformanceLogger('getUserWithStats', discordId);

    try {
      const user = await prisma.user.findUnique({
        where: { discordId },
        include: {
          userStats: true,
          submissions: {
            include: {
              feedback: true,
              assignment: {
                select: { category: true },
              },
            },
            orderBy: { submittedAt: 'desc' },
          },
        },
      });

      if (!user) {
        perf.end();
        return null;
      }

      // Calculate additional stats if needed
      const submissions = user.submissions;
      const completedSubmissions = submissions.filter(s => s.feedback);
      const scores = completedSubmissions
        .map(s => s.feedback?.aiScore)
        .filter(score => score && typeof score === 'object' && 'overall' in score)
        .map(score => (score as any).overall);

      // Find most common category
      const categoryCount: Record<string, number> = {};
      submissions.forEach(s => {
        if (s.assignment.category) {
          categoryCount[s.assignment.category] = (categoryCount[s.assignment.category] || 0) + 1;
        }
      });
      const categoryKeys = Object.keys(categoryCount);
      const bestCategory = categoryKeys.length > 0 
        ? categoryKeys.reduce((a, b) => categoryCount[a] > categoryCount[b] ? a : b)
        : null;

      const userWithStats: UserWithStats = {
        ...user,
        stats: {
          totalSubmissions: submissions.length,
          completedAssignments: completedSubmissions.length,
          averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
          streakDays: user.userStats?.streakDays || 0,
          lastSubmissionAt: submissions.length > 0 ? submissions[0].submittedAt : null,
          bestCategory,
        },
      };

      perf.end();
      return userWithStats;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`사용자 통계 조회 실패 (${discordId}):`, error);
      return null;
    }
  }

  /**
   * Update user information
   */
  static async updateUser(discordId: string, data: UpdateUserData): Promise<User | null> {
    const perf = new PerformanceLogger('updateUser', discordId);

    try {
      const user = await prisma.user.update({
        where: { discordId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      // Update cache
      await DiscordCache.setUser(discordId, user);

      logger.info(`사용자 정보 업데이트: ${user.username} (${discordId})`);
      perf.end();

      return user;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`사용자 업데이트 실패 (${discordId}):`, error);
      return null;
    }
  }

  /**
   * Update user activity (last seen)
   */
  static async updateActivity(discordId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { discordId },
        data: { lastSeenAt: new Date() },
      });

      // Update cache if exists
      const cachedUser = await DiscordCache.getUser(discordId);
      if (cachedUser) {
        cachedUser.lastSeenAt = new Date();
        await DiscordCache.setUser(discordId, cachedUser);
      }
    } catch (error) {
      // Silent fail for activity updates
      logger.debug(`활동 업데이트 실패 (${discordId}):`, error);
    }
  }

  /**
   * Get active users (seen within specified hours)
   */
  static async getActiveUsers(hoursAgo: number = 24): Promise<User[]> {
    const perf = new PerformanceLogger('getActiveUsers');

    try {
      const since = new Date();
      since.setHours(since.getHours() - hoursAgo);

      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          lastSeenAt: {
            gte: since,
          },
        },
        orderBy: { lastSeenAt: 'desc' },
      });

      perf.end();
      return users;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`활성 사용자 조회 실패:`, error);
      return [];
    }
  }

  /**
   * Search users by username (Korean text search)
   */
  static async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    const perf = new PerformanceLogger('searchUsers');

    try {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { username: { search: query } },
            { displayName: { search: query } },
          ],
        },
        take: limit,
        orderBy: {
          _relevance: {
            fields: ['username', 'displayName'],
            search: query,
            sort: 'desc',
          },
        },
      });

      perf.end();
      return users;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`사용자 검색 실패 (${query}):`, error);
      return [];
    }
  }

  /**
   * Get user leaderboard by average score
   */
  static async getLeaderboard(limit: number = 10): Promise<UserWithStats[]> {
    const perf = new PerformanceLogger('getUserLeaderboard');

    try {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          userStats: {
            averageScore: { not: null },
            totalSubmissions: { gte: 3 }, // At least 3 submissions
          },
        },
        include: {
          userStats: true,
        },
        orderBy: {
          userStats: {
            averageScore: 'desc',
          },
        },
        take: limit,
      });

      const leaderboard: UserWithStats[] = users.map(user => ({
        ...user,
        stats: {
          totalSubmissions: user.userStats?.totalSubmissions || 0,
          completedAssignments: user.userStats?.completedAssignments || 0,
          averageScore: user.userStats?.averageScore || null,
          streakDays: user.userStats?.streakDays || 0,
          lastSubmissionAt: user.userStats?.lastSubmissionAt || null,
          bestCategory: user.userStats?.bestCategory || null,
        },
      }));

      perf.end();
      return leaderboard;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('리더보드 조회 실패:', error);
      return [];
    }
  }

  /**
   * Update user statistics after submission
   */
  static async updateUserStats(userId: string): Promise<void> {
    try {
      const submissions = await prisma.submission.findMany({
        where: { userId },
        include: {
          feedback: true,
          assignment: {
            select: { category: true },
          },
        },
      });

      const completedSubmissions = submissions.filter(s => s.feedback);
      const scores = completedSubmissions
        .map(s => s.feedback?.aiScore)
        .filter(score => score && typeof score === 'object' && 'overall' in score)
        .map(score => (score as any).overall);

      // Calculate streak days (simplified - consecutive submission days)
      const submissionDates = submissions
        .map(s => s.submittedAt.toDateString())
        .filter((date, index, arr) => arr.indexOf(date) === index)
        .sort();

      let streakDays = 0;
      const today = new Date().toDateString();
      let currentDate = new Date();

      for (let i = submissionDates.length - 1; i >= 0; i--) {
        const submissionDate = submissionDates[i];
        const expectedDate = currentDate.toDateString();
        
        if (submissionDate === expectedDate) {
          streakDays++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Find most common category
      const categoryCount: Record<string, number> = {};
      submissions.forEach(s => {
        if (s.assignment.category) {
          categoryCount[s.assignment.category] = (categoryCount[s.assignment.category] || 0) + 1;
        }
      });
      const categoryKeys = Object.keys(categoryCount);
      const bestCategory = categoryKeys.length > 0 
        ? categoryKeys.reduce((a, b) => categoryCount[a] > categoryCount[b] ? a : b)
        : null;

      await prisma.userStats.upsert({
        where: { userId },
        update: {
          totalSubmissions: submissions.length,
          completedAssignments: completedSubmissions.length,
          averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
          lastSubmissionAt: submissions.length > 0 ? submissions[0].submittedAt : null,
          bestCategory,
          streakDays,
          updatedAt: new Date(),
        },
        create: {
          userId,
          totalSubmissions: submissions.length,
          completedAssignments: completedSubmissions.length,
          averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
          lastSubmissionAt: submissions.length > 0 ? submissions[0].submittedAt : null,
          bestCategory,
          streakDays,
        },
      });

      logger.info(`사용자 통계 업데이트: ${userId}`);
    } catch (error) {
      logger.error(`사용자 통계 업데이트 실패 (${userId}):`, error);
    }
  }

  /**
   * Deactivate user (soft delete)
   */
  static async deactivateUser(discordId: string): Promise<boolean> {
    const perf = new PerformanceLogger('deactivateUser', discordId);

    try {
      await prisma.user.update({
        where: { discordId },
        data: { isActive: false },
      });

      // Remove from cache
      await cache.delete(`user:${discordId}`, 'discord:');

      logger.info(`사용자 비활성화: ${discordId}`);
      perf.end();

      return true;
    } catch (error) {
      perf.end(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error(`사용자 비활성화 실패 (${discordId}):`, error);
      return false;
    }
  }

  /**
   * Check if user exists by Discord ID
   */
  static async existsByDiscordId(discordId: string): Promise<boolean> {
    try {
      // Check cache first
      if (await DiscordCache.getUser(discordId)) {
        return true;
      }

      // Check database
      const count = await prisma.user.count({
        where: { discordId },
      });

      return count > 0;
    } catch (error) {
      logger.error(`사용자 존재 확인 실패 (${discordId}):`, error);
      return false;
    }
  }
}

export default UserService;