import { Router } from 'express';
import { SubmissionController } from '../controllers/SubmissionController';
import { authenticateToken, requireOwnershipOrAdmin } from '../middleware/auth';
import { submissionRateLimiter, feedbackRateLimiter, aiRateLimiter } from '../middleware/rateLimiter';
import { validateRequestBody, validateParams, blogSubmissionSchema, codeSubmissionSchema } from '../utils/validation';
import Joi from 'joi';
import { prisma, cacheService, aiService } from '../index';
import { ContentFetcher } from '../services/ContentFetcher';

const router = Router();
const contentFetcher = new ContentFetcher();
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