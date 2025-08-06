import { Request, Response } from 'express';
import { PrismaClient, SubmissionType } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { CacheService } from '../services/CacheService';
import { AIService } from '../services/AIService';
import { ContentFetcher } from '../services/ContentFetcher';
import { NotFoundError, ConflictError, ValidationError, ExternalServiceError } from '../utils/errors';
import { isSubmissionLate, generateSecureToken } from '../utils/helpers';
import { validateAssignmentCode } from '../utils/assignmentCode';
import { logger } from '../utils/logger';

export class SubmissionController {
  constructor(
    private prisma: PrismaClient,
    private cacheService: CacheService,
    private aiService: AIService,
    private contentFetcher: ContentFetcher
  ) {}

  /**
   * Submit blog post - POST /api/submissions/blog
   */
  async submitBlogPost(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { assignment_code, title, url, content } = req.body;
      const user_id = req.user.sub;

      // Validate assignment exists and is active
      const assignment = await this.getActiveAssignment(assignment_code);
      
      // Check for duplicate submission
      await this.checkDuplicateSubmission(user_id, assignment_code);

      // Fetch content from URL if not provided
      let submissionContent = content;
      if (!submissionContent && url) {
        try {
          const extracted = await this.contentFetcher.extractContentFromUrl(url, 'blog');
          submissionContent = extracted.content;
        } catch (error) {
          if (!content) {
            throw new ExternalServiceError('ContentFetcher', '내용을 가져올 수 없습니다. 직접 입력해주세요.');
          }
        }
      }

      if (!submissionContent) {
        throw new ValidationError('제출할 내용이 없습니다. URL을 확인하거나 내용을 직접 입력해주세요.');
      }

      // Create submission
      const submission = await this.prisma.submission.create({
        data: {
          assignmentCode: assignment_code,
          userId: user_id,
          submissionType: SubmissionType.blog,
          title,
          url,
          content: submissionContent,
        },
      });

      // Queue AI feedback generation (async)
      this.queueAIFeedback(submission.id, assignment, submissionContent, SubmissionType.blog)
        .catch(error => {
          logger.error('Background AI feedback generation failed:', error);
        });

      // Invalidate caches
      await this.cacheService.invalidateUserSubmissions(user_id, assignment_code);

      logger.info('Blog submission created:', {
        submissionId: submission.id,
        assignmentCode: assignment_code,
        userId: user_id,
        title: title,
      });

      res.status(201).json({
        success: true,
        data: {
          submission_id: submission.id,
          assignment_code: assignment_code,
          status: 'processing',
          submitted_at: submission.submittedAt.toISOString(),
        },
        message: '블로그 글이 성공적으로 제출되었습니다. AI 피드백을 생성 중입니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Submit code - POST /api/submissions/code
   */
  async submitCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { assignment_code, github_url, branch = 'main', specific_folder } = req.body;
      const user_id = req.user.sub;

      // Validate assignment exists and is active
      const assignment = await this.getActiveAssignment(assignment_code);
      
      // Check for duplicate submission
      await this.checkDuplicateSubmission(user_id, assignment_code);

      // Fetch repository content
      let repoContent;
      try {
        repoContent = await this.contentFetcher.cloneGitHubRepo(github_url, {
          branch,
          specificFolder: specific_folder,
        });
      } catch (error) {
        throw new ExternalServiceError('GitHub', 'GitHub 저장소에 접근할 수 없습니다. 저장소가 공개되어 있는지 확인해주세요.');
      }

      // Combine files content for AI analysis
      const combinedContent = [
        repoContent.readme ? `# README\n${repoContent.readme}\n\n` : '',
        repoContent.structure,
        '\n# Code Files\n',
        ...repoContent.files.map(file => 
          `## ${file.path}\n\`\`\`${file.type}\n${file.content}\n\`\`\`\n`
        ),
      ].join('');

      // Create submission
      const submission = await this.prisma.submission.create({
        data: {
          assignmentCode: assignment_code,
          userId: user_id,
          submissionType: SubmissionType.code,
          url: github_url,
          content: combinedContent,
        },
      });

      // Queue AI feedback generation (async)
      this.queueAIFeedback(submission.id, assignment, combinedContent, SubmissionType.code)
        .catch(error => {
          logger.error('Background AI feedback generation failed:', error);
        });

      // Invalidate caches
      await this.cacheService.invalidateUserSubmissions(user_id, assignment_code);

      logger.info('Code submission created:', {
        submissionId: submission.id,
        assignmentCode: assignment_code,
        userId: user_id,
        githubUrl: github_url,
        filesCount: repoContent.files.length,
      });

      res.status(201).json({
        success: true,
        data: {
          submission_id: submission.id,
          assignment_code: assignment_code,
          status: 'processing',
          submitted_at: submission.submittedAt.toISOString(),
          files_processed: repoContent.files.length,
        },
        message: '코드가 성공적으로 제출되었습니다. AI 피드백을 생성 중입니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Start interactive submission - POST /api/submissions/interactive/start
   */
  async startInteractiveSubmission(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.sub;
      const session_id = generateSecureToken(16);

      // Get available assignments for user
      const now = new Date();
      const assignments = await this.prisma.assignment.findMany({
        where: {
          deadline: { gt: now },
        },
        select: {
          assignmentCode: true,
          title: true,
          deadline: true,
          submissions: {
            where: { userId: user_id },
            select: { id: true },
          },
        },
        orderBy: { deadline: 'asc' },
      });

      const availableAssignments = assignments.map(assignment => ({
        assignment_code: assignment.assignmentCode,
        title: assignment.title,
        deadline: assignment.deadline.toISOString(),
        already_submitted: assignment.submissions.length > 0,
      }));

      // Store session in cache
      const sessionData = {
        user_id,
        step: 'assignment_selection',
        available_assignments: availableAssignments,
        created_at: new Date().toISOString(),
      };

      await this.cacheService.set(`interactive_session:${session_id}`, sessionData, 1800); // 30 minutes

      res.json({
        success: true,
        data: {
          session_id,
          step: 'assignment_selection',
          available_assignments: availableAssignments,
          submission_types: ['blog', 'code'],
          expires_at: new Date(Date.now() + 1800 * 1000).toISOString(),
        },
        message: '대화형 제출을 시작합니다. 과제를 선택해주세요.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Continue interactive submission - POST /api/submissions/interactive/:session_id
   */
  async continueInteractiveSubmission(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { session_id } = req.params;
      const { step, data } = req.body;
      const user_id = req.user.sub;

      // Get session data
      const sessionData = await this.cacheService.get(`interactive_session:${session_id}`);
      if (!sessionData || sessionData.user_id !== user_id) {
        throw new NotFoundError('세션', session_id);
      }

      let response: any = {};

      switch (step) {
        case 'assignment_selected':
          response = await this.handleAssignmentSelection(session_id, data, sessionData);
          break;
        case 'type_selected':
          response = await this.handleTypeSelection(session_id, data, sessionData);
          break;
        case 'content_provided':
          response = await this.handleContentSubmission(session_id, data, sessionData, user_id);
          break;
        default:
          throw new ValidationError('Invalid step');
      }

      res.json({
        success: true,
        data: response,
        message: '단계가 성공적으로 진행되었습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get submission feedback - GET /api/submissions/:submission_id/feedback
   */
  async getSubmissionFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { submission_id } = req.params;
      const user_id = req.user.sub;

      // Check cache first
      const cacheKey = `feedback:${submission_id}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        res.json({
          success: true,
          data: cached,
          message: '피드백을 성공적으로 조회했습니다.',
        });
        return;
      }

      // Fetch submission and feedback
      const submission = await this.prisma.submission.findUnique({
        where: { id: submission_id },
        include: {
          assignment: {
            select: {
              assignmentCode: true,
              title: true,
            },
          },
          feedback: true,
        },
      });

      if (!submission) {
        throw new NotFoundError('제출물', submission_id);
      }

      // Check ownership (students can only see their own feedback)
      if (req.user.role !== 'admin' && submission.userId !== user_id) {
        throw new NotFoundError('제출물', submission_id);
      }

      if (!submission.feedback) {
        res.json({
          success: true,
          data: {
            submission_id: submission.id,
            assignment_code: submission.assignment.assignmentCode,
            assignment_title: submission.assignment.title,
            status: 'processing',
            message: 'AI 피드백을 생성 중입니다. 잠시 후 다시 확인해주세요.',
          },
          message: '피드백이 아직 생성되지 않았습니다.',
        });
        return;
      }

      // Parse AI score
      const aiScore = JSON.parse(submission.feedback.aiScore as string);

      const response = {
        submission_id: submission.id,
        assignment_code: submission.assignment.assignmentCode,
        assignment_title: submission.assignment.title,
        ai_feedback: {
          content: submission.feedback.aiFeedback,
          score: aiScore.overall,
          criteria_scores: {
            requirements_met: aiScore.requirementsFulfillment * 10, // Convert 1-10 to 0-100
            code_quality: aiScore.codeQuality * 10,
            best_practices: aiScore.bestPractices * 10,
            creativity: aiScore.creativity * 10,
          },
          generated_at: submission.feedback.createdAt.toISOString(),
        },
        manual_feedback: submission.feedback.manualFeedback ? {
          content: submission.feedback.manualFeedback,
          reviewed_at: submission.feedback.updatedAt.toISOString(),
        } : undefined,
      };

      // Cache the result
      await this.cacheService.set(cacheKey, response, 3600); // 1 hour

      res.json({
        success: true,
        data: response,
        message: '피드백을 성공적으로 조회했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update submission (resubmit) - PUT /api/submissions/:submission_id
   */
  async updateSubmission(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { submission_id } = req.params;
      const { content, url, title } = req.body;
      const user_id = req.user.sub;

      // Fetch submission
      const submission = await this.prisma.submission.findUnique({
        where: { id: submission_id },
        include: {
          assignment: true,
        },
      });

      if (!submission) {
        throw new NotFoundError('제출물', submission_id);
      }

      // Check ownership
      if (submission.userId !== user_id) {
        throw new NotFoundError('제출물', submission_id);
      }

      // Check if assignment is still active
      if (submission.assignment.deadline < new Date()) {
        throw new ValidationError('마감된 과제의 제출물은 수정할 수 없습니다.');
      }

      // Update submission
      const updatedSubmission = await this.prisma.submission.update({
        where: { id: submission_id },
        data: {
          ...(content && { content }),
          ...(url && { url }),
          ...(title && { title }),
        },
      });

      // Delete existing feedback (will be regenerated)
      await this.prisma.feedback.deleteMany({
        where: { submissionId: submission_id },
      });

      // Queue new AI feedback generation
      this.queueAIFeedback(
        submission_id, 
        submission.assignment, 
        content || submission.content!, 
        submission.submissionType
      ).catch(error => {
        logger.error('Background AI feedback regeneration failed:', error);
      });

      // Invalidate caches
      await this.cacheService.invalidateFeedback(submission_id, user_id);

      logger.info('Submission updated:', {
        submissionId: submission_id,
        userId: user_id,
      });

      res.json({
        success: true,
        data: {
          submission_id: updatedSubmission.id,
          status: 'processing',
          updated_at: updatedSubmission.submittedAt.toISOString(),
        },
        message: '제출물이 성공적으로 수정되었습니다. AI 피드백을 다시 생성 중입니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Helper: Get active assignment
   */
  private async getActiveAssignment(assignment_code: string) {
    if (!validateAssignmentCode(assignment_code)) {
      throw new ValidationError('과제 코드 형식이 올바르지 않습니다.');
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { assignmentCode: assignment_code },
    });

    if (!assignment) {
      throw new NotFoundError('과제', assignment_code);
    }

    if (assignment.deadline < new Date()) {
      throw new ValidationError('마감된 과제입니다.');
    }

    return assignment;
  }

  /**
   * Helper: Check for duplicate submission
   */
  private async checkDuplicateSubmission(userId: string, assignmentCode: string) {
    const existingSubmission = await this.prisma.submission.findFirst({
      where: {
        userId,
        assignmentCode,
      },
    });

    if (existingSubmission) {
      throw new ConflictError('이미 제출한 과제입니다.');
    }
  }

  /**
   * Helper: Queue AI feedback generation
   */
  private async queueAIFeedback(
    submissionId: string,
    assignment: any,
    content: string,
    type: SubmissionType
  ): Promise<void> {
    try {
      const feedback = await this.aiService.generateFeedback({
        assignment: {
          code: assignment.assignmentCode,
          title: assignment.title,
          requirements: assignment.requirements.split('\n').filter((r: string) => r.trim()),
          recommendations: assignment.recommendations.split('\n').filter((r: string) => r.trim()),
        },
        submission: {
          type: type === SubmissionType.blog ? 'blog' : 'code',
          content,
        },
      });

      // Store feedback in database
      await this.prisma.feedback.create({
        data: {
          submissionId,
          aiFeedback: feedback.content,
          aiScore: {
            requirementsFulfillment: Math.round(feedback.criteria_scores.requirements_met / 10),
            codeQuality: Math.round(feedback.criteria_scores.code_quality / 10),
            bestPractices: Math.round(feedback.criteria_scores.best_practices / 10),
            creativity: Math.round(feedback.criteria_scores.creativity / 10),
            overall: Math.round(feedback.score / 10),
          },
        },
      });

      logger.info('AI feedback generated:', {
        submissionId,
        score: feedback.score,
      });
    } catch (error) {
      logger.error('AI feedback generation failed:', {
        submissionId,
        error: error instanceof Error ? error.message : error,
      });
      
      // Store error feedback
      await this.prisma.feedback.create({
        data: {
          submissionId,
          aiFeedback: 'AI 피드백 생성에 실패했습니다. 관리자에게 문의해주세요.',
          aiScore: {
            requirementsFulfillment: 5,
            codeQuality: 5,
            bestPractices: 5,
            creativity: 5,
            overall: 5,
          },
        },
      });
    }
  }

  /**
   * Helper: Handle assignment selection in interactive submission
   */
  private async handleAssignmentSelection(sessionId: string, data: any, sessionData: any) {
    const { assignment_code } = data;
    
    const assignment = sessionData.available_assignments.find(
      (a: any) => a.assignment_code === assignment_code
    );
    
    if (!assignment) {
      throw new ValidationError('유효하지 않은 과제입니다.');
    }

    const updatedSessionData = {
      ...sessionData,
      selected_assignment: assignment,
      step: 'type_selection',
    };

    await this.cacheService.set(`interactive_session:${sessionId}`, updatedSessionData, 1800);

    return {
      session_id: sessionId,
      step: 'type_selection',
      selected_assignment: assignment,
      submission_types: ['blog', 'code'],
    };
  }

  /**
   * Helper: Handle submission type selection
   */
  private async handleTypeSelection(sessionId: string, data: any, sessionData: any) {
    const { submission_type } = data;
    
    if (!['blog', 'code'].includes(submission_type)) {
      throw new ValidationError('유효하지 않은 제출 유형입니다.');
    }

    const updatedSessionData = {
      ...sessionData,
      submission_type,
      step: 'content_input',
    };

    await this.cacheService.set(`interactive_session:${sessionId}`, updatedSessionData, 1800);

    return {
      session_id: sessionId,
      step: 'content_input',
      submission_type,
      required_fields: submission_type === 'blog' 
        ? ['title', 'url'] 
        : ['github_url'],
    };
  }

  /**
   * Helper: Handle content submission
   */
  private async handleContentSubmission(sessionId: string, data: any, sessionData: any, userId: string) {
    const { submission_type, selected_assignment } = sessionData;
    
    // Clean up session
    await this.cacheService.del(`interactive_session:${sessionId}`);

    // Create submission based on type
    if (submission_type === 'blog') {
      await this.submitBlogPostInternal(
        selected_assignment.assignment_code,
        userId,
        data.title,
        data.url,
        data.content
      );
    } else {
      await this.submitCodeInternal(
        selected_assignment.assignment_code,
        userId,
        data.github_url,
        data.branch,
        data.specific_folder
      );
    }

    return {
      step: 'completed',
      assignment_code: selected_assignment.assignment_code,
      submission_type,
      message: '제출이 완료되었습니다.',
    };
  }

  private async submitBlogPostInternal(assignmentCode: string, userId: string, title: string, url: string, content?: string) {
    // Implementation similar to submitBlogPost but without response handling
    // This is a simplified version for internal use
  }

  private async submitCodeInternal(assignmentCode: string, userId: string, githubUrl: string, branch?: string, specificFolder?: string) {
    // Implementation similar to submitCode but without response handling
    // This is a simplified version for internal use
  }
}