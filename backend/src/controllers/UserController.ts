import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { CacheService } from '../services/CacheService';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getTimeRemaining, isSubmissionLate } from '../utils/helpers';
import { validateAssignmentCode } from '../utils/assignmentCode';
import { logger } from '../utils/logger';

export class UserController {
  constructor(
    private prisma: PrismaClient,
    private cacheService: CacheService
  ) {}

  /**
   * Get user's submission for specific assignment - GET /api/users/me/submissions/:assignment_code
   */
  async getMySubmissionForAssignment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { assignment_code } = req.params;
      const user_id = req.user.sub;

      if (!validateAssignmentCode(assignment_code)) {
        throw new ValidationError('과제 코드 형식이 올바르지 않습니다.');
      }

      // Check cache first
      const cacheKey = `user:${user_id}:submission:${assignment_code}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        res.json({
          success: true,
          data: cached,
          message: '제출 현황을 성공적으로 조회했습니다.',
        });
        return;
      }

      // Fetch assignment and user's submission
      const assignment = await this.prisma.assignment.findUnique({
        where: { assignmentCode: assignment_code },
        include: {
          submissions: {
            where: { userId: user_id },
            include: {
              feedback: {
                select: {
                  aiScore: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      if (!assignment) {
        throw new NotFoundError('과제', assignment_code);
      }

      const userSubmission = assignment.submissions[0];
      const now = new Date();
      const timeRemaining = assignment.deadline > now ? getTimeRemaining(assignment.deadline) : null;

      const response = {
        assignment_code: assignment.assignmentCode,
        assignment_title: assignment.title,
        deadline: assignment.deadline.toISOString(),
        my_submission: userSubmission ? {
          submission_id: userSubmission.id,
          type: userSubmission.submissionType,
          submitted_at: userSubmission.submittedAt.toISOString(),
          status: this.getSubmissionStatus(userSubmission, assignment.deadline),
          score: userSubmission.feedback?.aiScore ? 
            JSON.parse(userSubmission.feedback.aiScore as string).overall * 10 : 
            undefined,
          feedback_available: !!userSubmission.feedback,
        } : undefined,
        time_remaining: timeRemaining,
      };

      // Cache the result
      await this.cacheService.set(cacheKey, response, 120); // 2 minutes

      res.json({
        success: true,
        data: response,
        message: '제출 현황을 성공적으로 조회했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's overall status - GET /api/users/me/status
   */
  async getMyStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.sub;

      // Check cache first
      const cacheKey = `user:${user_id}:status`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        res.json({
          success: true,
          data: cached,
          message: '현황을 성공적으로 조회했습니다.',
        });
        return;
      }

      // Fetch user and their submissions
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        include: {
          submissions: {
            include: {
              assignment: {
                select: {
                  assignmentCode: true,
                  title: true,
                  deadline: true,
                },
              },
              feedback: {
                select: {
                  aiScore: true,
                },
              },
            },
            orderBy: {
              submittedAt: 'desc',
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundError('사용자', user_id);
      }

      // Get all assignments
      const allAssignments = await this.prisma.assignment.findMany({
        select: {
          assignmentCode: true,
          title: true,
          deadline: true,
        },
        orderBy: {
          deadline: 'desc',
        },
      });

      const now = new Date();

      // Calculate statistics
      const completedAssignments = user.submissions.length;
      const totalAssignments = allAssignments.length;
      const completionRate = totalAssignments > 0 ? 
        Math.round((completedAssignments / totalAssignments) * 100) : 0;

      // Calculate scores
      const scores = user.submissions
        .filter(s => s.feedback?.aiScore)
        .map(s => JSON.parse(s.feedback!.aiScore as string).overall * 10);
      
      const averageScore = scores.length > 0 ? 
        Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;

      // Count on-time vs late submissions
      const onTimeSubmissions = user.submissions.filter(s => 
        s.submittedAt <= s.assignment.deadline
      ).length;
      const lateSubmissions = completedAssignments - onTimeSubmissions;

      // Recent submissions (last 5)
      const recentSubmissions = user.submissions.slice(0, 5).map(submission => ({
        assignment_code: submission.assignment.assignmentCode,
        assignment_title: submission.assignment.title,
        submitted_at: submission.submittedAt.toISOString(),
        score: submission.feedback?.aiScore ? 
          JSON.parse(submission.feedback.aiScore as string).overall * 10 : 
          undefined,
        status: this.getSubmissionStatus(submission, submission.assignment.deadline),
      }));

      // Active assignments (not yet submitted and not expired)
      const submittedAssignmentCodes = new Set(user.submissions.map(s => s.assignment.assignmentCode));
      const activeAssignments = allAssignments
        .filter(assignment => 
          assignment.deadline > now && !submittedAssignmentCodes.has(assignment.assignmentCode)
        )
        .map(assignment => ({
          assignment_code: assignment.assignmentCode,
          title: assignment.title,
          deadline: assignment.deadline.toISOString(),
          status: 'not_submitted' as const,
          time_remaining: getTimeRemaining(assignment.deadline),
        }));

      // Add submitted but active assignments
      const submittedActiveAssignments = allAssignments
        .filter(assignment => 
          assignment.deadline > now && submittedAssignmentCodes.has(assignment.assignmentCode)
        )
        .map(assignment => ({
          assignment_code: assignment.assignmentCode,
          title: assignment.title,
          deadline: assignment.deadline.toISOString(),
          status: 'submitted' as const,
          time_remaining: getTimeRemaining(assignment.deadline),
        }));

      const response = {
        user_info: {
          username: user.username,
          total_assignments: totalAssignments,
          completed_assignments: completedAssignments,
          completion_rate: completionRate,
        },
        recent_submissions: recentSubmissions,
        active_assignments: [...activeAssignments, ...submittedActiveAssignments].sort((a, b) => 
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        ),
        statistics: {
          average_score: averageScore,
          on_time_submissions: onTimeSubmissions,
          late_submissions: lateSubmissions,
        },
      };

      // Cache the result
      await this.cacheService.set(cacheKey, response, 300); // 5 minutes

      res.json({
        success: true,
        data: response,
        message: '현황을 성공적으로 조회했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all user's submissions - GET /api/users/me/submissions
   */
  async getMySubmissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.sub;
      const { limit = 20, offset = 0, assignment_code } = req.query as any;

      // Build cache key
      const cacheKey = `user:${user_id}:submissions:${limit}:${offset}:${assignment_code || 'all'}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        res.json({
          success: true,
          data: cached,
          message: '제출 목록을 성공적으로 조회했습니다.',
        });
        return;
      }

      // Build where clause
      const where: any = { userId: user_id };
      if (assignment_code) {
        if (!validateAssignmentCode(assignment_code)) {
          throw new ValidationError('과제 코드 형식이 올바르지 않습니다.');
        }
        where.assignmentCode = assignment_code;
      }

      // Fetch submissions
      const [submissions, total] = await Promise.all([
        this.prisma.submission.findMany({
          where,
          include: {
            assignment: {
              select: {
                assignmentCode: true,
                title: true,
                deadline: true,
              },
            },
            feedback: {
              select: {
                aiScore: true,
                createdAt: true,
              },
            },
          },
          orderBy: {
            submittedAt: 'desc',
          },
          take: Number(limit),
          skip: Number(offset),
        }),
        this.prisma.submission.count({ where }),
      ]);

      // Format submissions
      const formattedSubmissions = submissions.map(submission => ({
        submission_id: submission.id,
        assignment_code: submission.assignment.assignmentCode,
        assignment_title: submission.assignment.title,
        type: submission.submissionType,
        title: submission.title,
        url: submission.url,
        submitted_at: submission.submittedAt.toISOString(),
        deadline: submission.assignment.deadline.toISOString(),
        status: this.getSubmissionStatus(submission, submission.assignment.deadline),
        score: submission.feedback?.aiScore ? 
          JSON.parse(submission.feedback.aiScore as string).overall * 10 : 
          undefined,
        feedback_available: !!submission.feedback,
        is_late: isSubmissionLate(submission.submittedAt, submission.assignment.deadline),
      }));

      const response = {
        submissions: formattedSubmissions,
        total,
        has_more: offset + limit < total,
      };

      // Cache the result
      await this.cacheService.set(cacheKey, response, 120); // 2 minutes

      res.json({
        success: true,
        data: response,
        message: '제출 목록을 성공적으로 조회했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user profile - PUT /api/users/me
   */
  async updateMyProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.sub;
      const { username } = req.body;

      if (!username || username.trim().length === 0) {
        throw new ValidationError('사용자명을 입력해주세요.');
      }

      if (username.length > 50) {
        throw new ValidationError('사용자명은 50자 이내로 입력해주세요.');
      }

      // Update user
      const user = await this.prisma.user.update({
        where: { id: user_id },
        data: {
          username: username.trim(),
        },
      });

      // Invalidate user caches
      await this.cacheService.delPattern(`user:${user_id}:*`);

      logger.info('User profile updated:', {
        userId: user_id,
        newUsername: username,
      });

      res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          updated_at: user.updatedAt.toISOString(),
        },
        message: '프로필이 성공적으로 업데이트되었습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user profile - GET /api/users/me
   */
  async getMyProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.sub;

      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: {
          id: true,
          discordId: true,
          username: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              submissions: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundError('사용자', user_id);
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          discord_id: user.discordId,
          username: user.username,
          total_submissions: user._count.submissions,
          created_at: user.createdAt.toISOString(),
          updated_at: user.updatedAt.toISOString(),
        },
        message: '프로필을 성공적으로 조회했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user leaderboard - GET /api/users/leaderboard
   */
  async getLeaderboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { limit = 10 } = req.query as any;

      // Check cache first
      const cacheKey = `leaderboard:${limit}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        res.json({
          success: true,
          data: cached,
          message: '리더보드를 성공적으로 조회했습니다.',
        });
        return;
      }

      // Get users with their submission statistics
      const users = await this.prisma.user.findMany({
        include: {
          submissions: {
            include: {
              assignment: {
                select: {
                  deadline: true,
                },
              },
              feedback: {
                select: {
                  aiScore: true,
                },
              },
            },
          },
        },
      });

      // Calculate statistics for each user
      const userStats = users
        .map(user => {
          const submissions = user.submissions;
          const completedSubmissions = submissions.length;
          
          if (completedSubmissions === 0) {
            return {
              username: user.username,
              total_submissions: 0,
              average_score: 0,
              on_time_rate: 0,
            };
          }

          // Calculate average score
          const scores = submissions
            .filter(s => s.feedback?.aiScore)
            .map(s => JSON.parse(s.feedback!.aiScore as string).overall * 10);
          
          const averageScore = scores.length > 0 ? 
            scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

          // Calculate on-time rate
          const onTimeSubmissions = submissions.filter(s => 
            s.submittedAt <= s.assignment.deadline
          ).length;
          
          const onTimeRate = Math.round((onTimeSubmissions / completedSubmissions) * 100);

          return {
            username: user.username,
            total_submissions: completedSubmissions,
            average_score: Math.round(averageScore),
            on_time_rate: onTimeRate,
          };
        })
        .filter(stats => stats.total_submissions > 0) // Only include users with submissions
        .sort((a, b) => {
          // Sort by average score first, then by on-time rate, then by total submissions
          if (b.average_score !== a.average_score) {
            return b.average_score - a.average_score;
          }
          if (b.on_time_rate !== a.on_time_rate) {
            return b.on_time_rate - a.on_time_rate;
          }
          return b.total_submissions - a.total_submissions;
        })
        .slice(0, Number(limit))
        .map((stats, index) => ({
          rank: index + 1,
          ...stats,
        }));

      // Cache the result
      await this.cacheService.set(cacheKey, userStats, 600); // 10 minutes

      res.json({
        success: true,
        data: userStats,
        message: '리더보드를 성공적으로 조회했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Helper: Get submission status
   */
  private getSubmissionStatus(submission: any, deadline: Date): 'processing' | 'completed' | 'late' {
    if (!submission.feedback) {
      return 'processing';
    }
    
    return isSubmissionLate(submission.submittedAt, deadline) ? 'late' : 'completed';
  }
}