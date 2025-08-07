import { Router } from 'express';
import { SubmissionController } from '../controllers/SubmissionController';
import { authenticateToken, requireOwnershipOrAdmin } from '../middleware/auth';
import { submissionRateLimiter, feedbackRateLimiter, aiRateLimiter } from '../middleware/rateLimiter';
import { validateRequestBody, validateParams, blogSubmissionSchema, codeSubmissionSchema } from '../utils/validation';
import Joi from 'joi';
import { prisma, cacheService, aiService } from '../index';
import { ContentFetcher } from '../services/ContentFetcher';
import { GitHubService } from '../services/GitHubService';

const router = Router();
const contentFetcher = new ContentFetcher();
const githubService = new GitHubService();
const submissionController = new SubmissionController(prisma, cacheService, aiService, contentFetcher);

// Validation schemas
const submissionIdParamSchema = Joi.object({
  submission_id: Joi.string().uuid().required().messages({
    'string.guid': '유효하지 않은 제출물 ID입니다.',
  }),
});

const sessionIdParamSchema = Joi.object({
  session_id: Joi.string().hex().length(32).required().messages({
    'string.hex': '유효하지 않은 세션 ID입니다.',
    'string.length': '유효하지 않은 세션 ID입니다.',
  }),
});

const interactiveStepSchema = Joi.object({
  step: Joi.string().valid('assignment_selected', 'type_selected', 'content_provided').required(),
  data: Joi.object().required(),
});

const updateSubmissionSchema = Joi.object({
  content: Joi.string().min(1).optional(),
  url: Joi.string().uri().optional(),
  title: Joi.string().min(1).max(200).optional(),
}).min(1).messages({
  'object.min': '최소 하나의 필드는 업데이트해야 합니다.',
});

const githubSubmissionSchema = Joi.object({
  assignment_code: Joi.string().length(6).required().messages({
    'string.length': '과제 코드는 6자리여야 합니다.',
    'any.required': '과제 코드는 필수입니다.',
  }),
  github_url: Joi.string().uri().pattern(/github\.com/).required().messages({
    'string.uri': '유효한 URL을 입력해주세요.',
    'string.pattern.base': 'GitHub URL을 입력해주세요.',
    'any.required': 'GitHub URL은 필수입니다.',
  }),
  folder_path: Joi.string().min(1).max(500).optional().messages({
    'string.min': '폴더 경로는 최소 1자 이상이어야 합니다.',
    'string.max': '폴더 경로는 최대 500자까지 가능합니다.',
  }),
  title: Joi.string().min(1).max(200).optional().messages({
    'string.min': '제목은 최소 1자 이상이어야 합니다.',
    'string.max': '제목은 최대 200자까지 가능합니다.',
  }),
});

// Submission routes
router.post('/blog',
  authenticateToken,
  submissionRateLimiter,
  aiRateLimiter,
  validateRequestBody(blogSubmissionSchema),
  submissionController.submitBlogPost.bind(submissionController)
);

router.post('/code',
  authenticateToken,
  submissionRateLimiter,
  aiRateLimiter,
  validateRequestBody(codeSubmissionSchema),
  submissionController.submitCode.bind(submissionController)
);

// GitHub 코드 제출
router.post('/github',
  authenticateToken,
  submissionRateLimiter,
  aiRateLimiter,
  validateRequestBody(githubSubmissionSchema),
  async (req, res) => {
    try {
      const { assignment_code, github_url, folder_path, title } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: 'error',
          message: '인증이 필요합니다.'
        });
      }

      // 1. 과제 확인
      const assignment = await prisma.assignment.findUnique({
        where: { assignmentCode: assignment_code }
      });

      if (!assignment) {
        return res.status(404).json({
          status: 'error',
          message: '존재하지 않는 과제입니다.'
        });
      }

      if (!assignment.isActive) {
        return res.status(400).json({
          status: 'error',
          message: '비활성화된 과제입니다.'
        });
      }

      // 2. 마감일 확인
      if (new Date() > assignment.deadline) {
        return res.status(400).json({
          status: 'error',
          message: '마감일이 지난 과제입니다.'
        });
      }

      // 3. GitHub 저장소에서 코드 가져오기
      const repoContent = await githubService.fetchRepositoryContent(github_url, folder_path);

      if (repoContent.files.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: '저장소에서 코드 파일을 찾을 수 없습니다.'
        });
      }

      // 4. 코드 내용 통합
      const codeContent = repoContent.files.map(file => 
        `## ${file.path}\n\n\`\`\`${file.language || 'text'}\n${file.content}\n\`\`\``
      ).join('\n\n');

      const fullContent = `# GitHub 저장소: ${github_url}\n\n` +
        `## 프로젝트 구조\n\`\`\`\n${repoContent.structure}\n\`\`\`\n\n` +
        `## 파일 내용\n\n${codeContent}`;

      // 5. 제출물 저장
      const submission = await prisma.submission.create({
        data: {
          assignmentCode: assignment_code,
          userId: userId,
          submissionType: 'code',
          content: fullContent,
          url: github_url,
          title: title || `GitHub 제출: ${repoContent.metadata.lastCommit?.message || '코드 제출'}`,
          metadata: {
            github: {
              repoInfo: githubService.parseRepositoryUrl(github_url),
              totalFiles: repoContent.metadata.totalFiles,
              totalSize: repoContent.metadata.totalSize,
              languages: repoContent.metadata.languages,
              lastCommit: repoContent.metadata.lastCommit
            }
          }
        }
      });

      // 6. AI 피드백 생성 (비동기)
      if (assignment.autoFeedback) {
        setImmediate(async () => {
          try {
            const feedbackRequest = {
              assignment: {
                code: assignment.assignmentCode,
                title: assignment.title,
                requirements: JSON.parse(assignment.requirements),
                recommendations: JSON.parse(assignment.recommendations),
                category: 'programming' as const
              },
              submission: {
                type: 'code' as const,
                content: fullContent,
                url: github_url,
                title: submission.title || undefined,
                metadata: submission.metadata
              }
            };

            const aiFeedback = await aiService.generateFeedback(feedbackRequest);

            await prisma.feedback.create({
              data: {
                submissionId: submission.id,
                aiFeedback: aiFeedback.content,
                aiScore: aiFeedback.criteria_scores,
                feedbackType: 'AI',
                aiModel: aiFeedback.model_info.model,
                aiTokensUsed: aiFeedback.model_info.tokens_used,
                processingTime: aiFeedback.cache_info.response_time_ms
              }
            });
          } catch (error) {
            console.error('AI 피드백 생성 실패:', error);
          }
        });
      }

      res.status(201).json({
        status: 'success',
        message: '코드가 성공적으로 제출되었습니다.',
        data: {
          submission_id: submission.id,
          assignment_code: assignment_code,
          github_url: github_url,
          files_processed: repoContent.metadata.totalFiles,
          languages_detected: Object.keys(repoContent.metadata.languages),
          submitted_at: submission.submittedAt,
          ai_feedback_pending: assignment.autoFeedback
        }
      });

    } catch (error) {
      console.error('GitHub 제출 처리 중 오류:', error);
      
      if (error instanceof Error && error.message.includes('GitHub')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }

      res.status(500).json({
        status: 'error',
        message: '제출 처리 중 오류가 발생했습니다.'
      });
    }
  }
);

// Interactive submission routes
router.post('/interactive/start',
  authenticateToken,
  submissionController.startInteractiveSubmission.bind(submissionController)
);

router.post('/interactive/:session_id',
  authenticateToken,
  validateParams(sessionIdParamSchema),
  validateRequestBody(interactiveStepSchema),
  submissionController.continueInteractiveSubmission.bind(submissionController)
);

// Feedback routes
router.get('/:submission_id/feedback',
  authenticateToken,
  feedbackRateLimiter,
  validateParams(submissionIdParamSchema),
  requireOwnershipOrAdmin((req) => {
    // For feedback routes, we need to check ownership at the controller level
    // since we need to fetch the submission first
    return '';
  }),
  submissionController.getSubmissionFeedback.bind(submissionController)
);

// Update submission
router.put('/:submission_id',
  authenticateToken,
  submissionRateLimiter,
  aiRateLimiter,
  validateParams(submissionIdParamSchema),
  validateRequestBody(updateSubmissionSchema),
  submissionController.updateSubmission.bind(submissionController)
);

export default router;