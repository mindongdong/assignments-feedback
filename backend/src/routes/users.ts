import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticateToken, requireOwnershipOrAdmin } from '../middleware/auth';
import { assignmentQueryRateLimiter } from '../middleware/rateLimiter';
import { validateRequestBody, validateParams, assignmentCodeSchema } from '../utils/validation';
import Joi from 'joi';
import { prisma, cacheService } from '../index';

const router = Router();
const userController = new UserController(prisma, cacheService);

// Validation schemas
const assignmentCodeParamSchema = Joi.object({
  assignment_code: Joi.string().pattern(/^[A-Z0-9]{6}$/).required().messages({
    'string.pattern.base': '과제 코드는 6자리 영문 대문자와 숫자 조합이어야 합니다.',
  }),
});

const updateProfileSchema = Joi.object({
  username: Joi.string().min(1).max(50).required().messages({
    'string.empty': '사용자명을 입력해주세요.',
    'string.max': '사용자명은 50자 이내로 입력해주세요.',
  }),
});

const submissionsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  offset: Joi.number().integer().min(0).optional().default(0),
  assignment_code: Joi.string().pattern(/^[A-Z0-9]{6}$/).optional(),
});

const leaderboardQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional().default(10),
});

// User profile routes
router.get('/me',
  authenticateToken,
  userController.getMyProfile.bind(userController)
);

router.put('/me',
  authenticateToken,
  validateRequestBody(updateProfileSchema),
  userController.updateMyProfile.bind(userController)
);

// User status and submissions
router.get('/me/status',
  authenticateToken,
  assignmentQueryRateLimiter,
  userController.getMyStatus.bind(userController)
);

router.get('/me/submissions',
  authenticateToken,
  assignmentQueryRateLimiter,
  userController.getMySubmissions.bind(userController)
);

router.get('/me/submissions/:assignment_code',
  authenticateToken,
  assignmentQueryRateLimiter,
  validateParams(assignmentCodeParamSchema),
  userController.getMySubmissionForAssignment.bind(userController)
);

// Leaderboard (public to authenticated users)
router.get('/leaderboard',
  authenticateToken,
  userController.getLeaderboard.bind(userController)
);

export default router;