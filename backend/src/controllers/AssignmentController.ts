import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { CacheService } from '../services/CacheService';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getTimeRemaining } from '../utils/helpers';
import { validateAssignmentCode, generateUniqueAssignmentCode } from '../utils/assignmentCode';
import { logger } from '../utils/logger';

export class AssignmentController {
  constructor(
    private prisma: PrismaClient,
    private cacheService: CacheService
  ) {}

  /**
   * Get assignment details - GET /api/assignments/:assignment_code
   */
  async getAssignmentDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { assignment_code } = req.params;
      const user_id = req.user.sub;

      // Validate assignment code format
      if (!validateAssignmentCode(assignment_code)) {
        throw new ValidationError('과제 코드 형식이 올바르지 않습니다. 6자리 영문/숫자 조합을 입력해주세요.', {
          provided: assignment_code,
          expected_format: 'ABC123',
          valid_pattern: '^[A-Z0-9]{6}$',
        });
      }

      // Check cache first
      const cacheKey = `assignment:${assignment_code}:${user_id}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        res.json({
          success: true,
          data: cached,
          message: '과제 정보를 성공적으로 조회했습니다.',
        });
        return;
      }

      // Fetch assignment from database
      const assignment = await this.prisma.assignment.findUnique({
        where: { assignmentCode: assignment_code },
        include: {
          submissions: {
            where: { userId: user_id },
            include: {
              feedback: true,
            },
          },
        },
      });

      if (!assignment) {
        throw new NotFoundError('과제', assignment_code);
      }

      // Format response
      const userSubmission = assignment.submissions[0];
      const response = {
        assignment_code: assignment.assignmentCode,
        title: assignment.title,
        description: assignment.description,
        requirements: assignment.requirements.split('\n').filter(r => r.trim()),
        recommendations: assignment.recommendations.split('\n').filter(r => r.trim()),
        deadline: assignment.deadline.toISOString(),
        created_at: assignment.createdAt.toISOString(),
        my_submission: userSubmission ? {
          id: userSubmission.id,
          status: this.getSubmissionStatus(userSubmission, assignment.deadline),
          submitted_at: userSubmission.submittedAt.toISOString(),
          score: userSubmission.feedback?.aiScore ? 
            JSON.parse(userSubmission.feedback.aiScore as string).overall : 
            undefined,
        } : undefined,
      };

      // Cache the result
      await this.cacheService.set(cacheKey, response, 300); // 5 minutes

      res.json({
        success: true,
        data: response,
        message: '과제 정보를 성공적으로 조회했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * List all assignments - GET /api/assignments
   */
  async listAssignments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.sub;
      const { status = 'active', sort = 'latest', limit = 20, offset = 0 } = req.query as any;

      // Build cache key
      const cacheKey = `assignments:list:${user_id}:${status}:${sort}:${limit}:${offset}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        res.json({
          success: true,
          data: cached,
          message: '과제 목록을 성공적으로 조회했습니다.',
        });
        return;
      }

      // Build where clause
      const where: any = {};
      const now = new Date();

      if (status === 'active') {
        where.deadline = { gt: now };
      } else if (status === 'closed') {
        where.deadline = { lte: now };
      }
      // 'all' status doesn't add any filter

      // Build order by clause
      const orderBy: any = {};
      if (sort === 'deadline') {
        orderBy.deadline = 'asc';
      } else {
        orderBy.createdAt = 'desc';
      }

      // Fetch assignments
      const [assignments, total] = await Promise.all([
        this.prisma.assignment.findMany({
          where,
          orderBy,
          take: Number(limit),
          skip: Number(offset),
          include: {
            submissions: {
              where: { userId: user_id },
              select: {
                id: true,
                submittedAt: true,
                feedback: {
                  select: {
                    aiScore: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.assignment.count({ where }),
      ]);

      // Format response
      const formattedAssignments = assignments.map(assignment => {
        const userSubmission = assignment.submissions[0];
        const isActive = assignment.deadline > now;
        
        let myStatus: 'submitted' | 'not_submitted' | 'late' = 'not_submitted';
        if (userSubmission) {
          myStatus = userSubmission.submittedAt > assignment.deadline ? 'late' : 'submitted';
        }

        return {
          assignment_code: assignment.assignmentCode,
          title: assignment.title,
          deadline: assignment.deadline.toISOString(),
          status: isActive ? 'active' : 'closed',
          my_status: myStatus,
          created_at: assignment.createdAt.toISOString(),
        };
      });

      const response = {
        assignments: formattedAssignments,
        total,
        has_more: offset + limit < total,
      };

      // Cache the result
      await this.cacheService.set(cacheKey, response, 60); // 1 minute

      res.json({
        success: true,
        data: response,
        message: '과제 목록을 성공적으로 조회했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create new assignment - POST /api/assignments (Admin only)
   */
  async createAssignment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, description, requirements, recommendations, deadline } = req.body;

      // Generate unique assignment code
      const assignmentCode = await generateUniqueAssignmentCode(async (code) => {
        const existing = await this.prisma.assignment.findUnique({
          where: { assignmentCode: code },
        });
        return !!existing;
      });

      // Create assignment
      const assignment = await this.prisma.assignment.create({
        data: {
          assignmentCode,
          title,
          description,
          requirements: Array.isArray(requirements) ? requirements.join('\n') : requirements,
          recommendations: Array.isArray(recommendations) ? recommendations.join('\n') : recommendations,
          deadline: new Date(deadline),
        },
      });

      // Invalidate cache
      await this.cacheService.delPattern('assignments:list:*');

      logger.info('Assignment created:', {
        assignmentCode: assignment.assignmentCode,
        title: assignment.title,
        createdBy: req.user.username,
      });

      res.status(201).json({
        success: true,
        data: {
          assignment_code: assignment.assignmentCode,
          title: assignment.title,
          deadline: assignment.deadline.toISOString(),
          created_at: assignment.createdAt.toISOString(),
        },
        message: '과제가 성공적으로 생성되었습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update assignment - PUT /api/assignments/:assignment_code (Admin only)
   */
  async updateAssignment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { assignment_code } = req.params;
      const { title, description, requirements, recommendations, deadline } = req.body;

      if (!validateAssignmentCode(assignment_code)) {
        throw new ValidationError('과제 코드 형식이 올바르지 않습니다.');
      }

      // Check if assignment exists
      const existingAssignment = await this.prisma.assignment.findUnique({
        where: { assignmentCode: assignment_code },
      });

      if (!existingAssignment) {
        throw new NotFoundError('과제', assignment_code);
      }

      // Update assignment
      const assignment = await this.prisma.assignment.update({
        where: { assignmentCode: assignment_code },
        data: {
          ...(title && { title }),
          ...(description && { description }),
          ...(requirements && { 
            requirements: Array.isArray(requirements) ? requirements.join('\n') : requirements 
          }),
          ...(recommendations && { 
            recommendations: Array.isArray(recommendations) ? recommendations.join('\n') : recommendations 
          }),
          ...(deadline && { deadline: new Date(deadline) }),
        },
      });

      // Invalidate caches
      await this.cacheService.invalidateAssignment(assignment_code);

      logger.info('Assignment updated:', {
        assignmentCode: assignment.assignmentCode,
        updatedBy: req.user.username,
      });

      res.json({
        success: true,
        data: {
          assignment_code: assignment.assignmentCode,
          title: assignment.title,
          updated_at: assignment.updatedAt.toISOString(),
        },
        message: '과제가 성공적으로 업데이트되었습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete assignment - DELETE /api/assignments/:assignment_code (Admin only)
   */
  async deleteAssignment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { assignment_code } = req.params;

      if (!validateAssignmentCode(assignment_code)) {
        throw new ValidationError('과제 코드 형식이 올바르지 않습니다.');
      }

      // Check if assignment exists
      const assignment = await this.prisma.assignment.findUnique({
        where: { assignmentCode: assignment_code },
        include: {
          submissions: {
            select: { id: true },
          },
        },
      });

      if (!assignment) {
        throw new NotFoundError('과제', assignment_code);
      }

      // Check if there are submissions
      if (assignment.submissions.length > 0) {
        throw new ValidationError('제출물이 있는 과제는 삭제할 수 없습니다.');
      }

      // Delete assignment
      await this.prisma.assignment.delete({
        where: { assignmentCode: assignment_code },
      });

      // Invalidate caches
      await this.cacheService.invalidateAssignment(assignment_code);

      logger.info('Assignment deleted:', {
        assignmentCode: assignment_code,
        deletedBy: req.user.username,
      });

      res.json({
        success: true,
        message: '과제가 성공적으로 삭제되었습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get assignment statistics - GET /api/assignments/:assignment_code/stats (Admin only)
   */
  async getAssignmentStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { assignment_code } = req.params;

      if (!validateAssignmentCode(assignment_code)) {
        throw new ValidationError('과제 코드 형식이 올바르지 않습니다.');
      }

      const assignment = await this.prisma.assignment.findUnique({
        where: { assignmentCode: assignment_code },
        include: {
          submissions: {
            include: {
              feedback: true,
            },
          },
        },
      });

      if (!assignment) {
        throw new NotFoundError('과제', assignment_code);
      }

      // Calculate statistics
      const totalSubmissions = assignment.submissions.length;
      const onTimeSubmissions = assignment.submissions.filter(s => 
        s.submittedAt <= assignment.deadline
      ).length;
      const lateSubmissions = totalSubmissions - onTimeSubmissions;

      const scores = assignment.submissions
        .filter(s => s.feedback?.aiScore)
        .map(s => JSON.parse(s.feedback!.aiScore as string).overall);
      
      const averageScore = scores.length > 0 ? 
        scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

      const stats = {
        assignment_code: assignment.assignmentCode,
        title: assignment.title,
        deadline: assignment.deadline.toISOString(),
        total_submissions: totalSubmissions,
        on_time_submissions: onTimeSubmissions,
        late_submissions: lateSubmissions,
        average_score: Math.round(averageScore * 100) / 100,
        submission_rate: `${Math.round((totalSubmissions / 100) * 100)}%`, // Assuming 100 students
        created_at: assignment.createdAt.toISOString(),
      };

      res.json({
        success: true,
        data: stats,
        message: '과제 통계를 성공적으로 조회했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Helper method to determine submission status
   */
  private getSubmissionStatus(submission: any, deadline: Date): 'submitted' | 'late' | 'graded' {
    if (submission.feedback) {
      return 'graded';
    }
    
    return submission.submittedAt > deadline ? 'late' : 'submitted';
  }
}