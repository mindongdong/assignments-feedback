/**
 * Database services export index
 * Centralized access to all database services with optimized imports
 */

// Core services
export { default as AssignmentService } from './assignmentService';
export { default as UserService } from './userService';  
export { default as SubmissionService } from './submissionService';
export { default as FeedbackService } from './feedbackService';
export { default as PerformanceService } from './performanceService';

// Service types - import from central types file
export type {
  AssignmentWithStats,
  CreateAssignmentData,
  AssignmentFilter,
  UserWithStats,
  CreateUserData,
  UpdateUserData,
  SubmissionWithDetails,
  CreateSubmissionData,
  SubmissionFilter,
  FeedbackWithDetails,
  CreateFeedbackData,
  UpdateFeedbackData,
  PerformanceMetrics,
  DiscordCommandMetrics,
} from '../types';

// Database client and cache
export { prisma, redis, checkDatabaseHealth, closeConnections, initializeDatabase } from '../client';
export { cache, DiscordCache } from '../cache';

// Utility exports for easy access
export {
  generateAssignmentCode,
  validateAssignmentCode,
  sanitizeAssignmentCode,
  formatAssignmentCodeForDiscord,
  parseAssignmentCodeFromDiscord,
  validateAssignmentCodeDetailed,
} from '../../utils/assignmentCode';

/**
 * Database service wrapper for Discord bot operations
 * Provides high-level operations optimized for Discord commands
 */
export class DiscordDatabaseService {
  /**
   * Get user with caching and create if not exists
   */
  static async getOrCreateUser(discordId: string, username: string) {
    const UserService = await import('./userService');
    return UserService.default.createOrGetUser({
      discordId,
      username,
      locale: 'ko',
      timezone: 'Asia/Seoul',
    });
  }

  /**
   * Get active assignment by code
   */
  static async getActiveAssignment(assignmentCode: string) {
    const AssignmentService = await import('./assignmentService');
    const assignment = await AssignmentService.default.getByCode(assignmentCode);
    
    if (!assignment || !assignment.isActive) {
      return null;
    }
    
    return assignment;
  }

  /**
   * Submit assignment with validation
   */
  static async submitAssignment(data: {
    assignmentCode: string;
    discordId: string;
    submissionType: 'blog' | 'code';
    url?: string;
    title?: string;
    content?: string;
  }) {
    const SubmissionService = await import('./submissionService');
    return SubmissionService.default.createSubmission({
      ...data,
      submissionType: data.submissionType as any,
    });
  }

  /**
   * Get user's submission status for assignment
   */
  static async getUserSubmissionStatus(discordId: string, assignmentCode: string) {
    const SubmissionService = await import('./submissionService');
    const submission = await SubmissionService.default.getLatestUserSubmission(
      discordId,
      assignmentCode
    );
    
    if (!submission) {
      return { status: 'not_submitted', submission: null };
    }
    
    return {
      status: submission.status.toLowerCase(),
      submission,
      hasFeedback: !!submission.feedback,
    };
  }

  /**
   * Get assignment list for Discord display
   */
  static async getAssignmentList(category?: string) {
    const AssignmentService = await import('./assignmentService');
    return AssignmentService.default.getActiveAssignments({
      category,
      deadlineAfter: new Date(), // Only future assignments
    });
  }

  /**
   * Get user statistics for profile display
   */
  static async getUserProfile(discordId: string) {
    const UserService = await import('./userService');
    return UserService.default.getUserWithStats(discordId);
  }

  /**
   * Get recent activity for user
   */
  static async getUserRecentActivity(discordId: string, limit: number = 5) {
    const SubmissionService = await import('./submissionService');
    return SubmissionService.default.getUserSubmissions(discordId);
  }

  /**
   * Get leaderboard for competition
   */
  static async getLeaderboard(limit: number = 10) {
    const UserService = await import('./userService');
    return UserService.default.getLeaderboard(limit);
  }

  /**
   * Check assignment deadline status
   */
  static async getDeadlineStatus(assignmentCode: string) {
    const assignment = await this.getActiveAssignment(assignmentCode);
    if (!assignment) return null;
    
    const now = new Date();
    const deadline = assignment.deadline;
    const msUntilDeadline = deadline.getTime() - now.getTime();
    const hoursUntilDeadline = msUntilDeadline / (1000 * 60 * 60);
    
    if (msUntilDeadline <= 0) {
      return { status: 'closed', message: '마감됨' };
    } else if (hoursUntilDeadline <= 24) {
      return { status: 'urgent', message: '마감 임박', hoursLeft: Math.round(hoursUntilDeadline) };
    } else {
      const daysLeft = Math.round(hoursUntilDeadline / 24);
      return { status: 'open', message: '진행중', daysLeft };
    }
  }

  /**
   * Log Discord command performance
   */
  static async logCommandPerformance(
    command: string,
    executionTime: number,
    success: boolean,
    discordId?: string,
    errorMessage?: string
  ) {
    const PerformanceService = await import('./performanceService');
    return PerformanceService.default.logDiscordCommand(
      command,
      executionTime,
      success,
      discordId,
      errorMessage ? 'command_error' : undefined,
      errorMessage ? { error: errorMessage } : undefined
    );
  }

  /**
   * Get Discord bot health status
   */
  static async getHealthStatus() {
    const { checkDatabaseHealth } = await import('../client');
    const PerformanceService = await import('./performanceService');
    
    const [dbHealth, alerts] = await Promise.all([
      checkDatabaseHealth(),
      PerformanceService.default.getPerformanceAlerts(),
    ]);
    
    return {
      database: dbHealth,
      alerts,
      timestamp: new Date(),
    };
  }
}

export default DiscordDatabaseService;