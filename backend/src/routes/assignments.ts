import { Router } from 'express';
import { AssignmentController } from '../controllers/AssignmentController';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { assignmentQueryRateLimiter } from '../middleware/rateLimiter';
import { validateRequestBody, validateQuery, validateParams, assignmentListQuerySchema, createAssignmentSchema } from '../utils/validation';
import Joi from 'joi';
import { prisma, cacheService } from '../index';

const router = Router();
const assignmentController = new AssignmentController(prisma, cacheService);

// Validation schemas
const assignmentCodeParamSchema = Joi.object({
  assignment_code: Joi.string().pattern(/^[A-Z0-9]{6}$/).required().messages({
    'string.pattern.base': '과제 코드는 6자리 영문 대문자와 숫자 조합이어야 합니다.',
  }),
});

const updateAssignmentSchema = Joi.object({
  title: Joi.string().min(1).max(200).optional(),
  description: Joi.string().min(1).optional(),
  requirements: Joi.alternatives().try(
    Joi.string().min(1),
    Joi.array().items(Joi.string().min(1))
  ).optional(),
  recommendations: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional(),
  deadline: Joi.date().min('now').optional(),
}).min(1).messages({
  'object.min': '최소 하나의 필드는 업데이트해야 합니다.',
});

// Public routes (with authentication)
router.get('/',
  authenticateToken,
  assignmentQueryRateLimiter,
  validateQuery(assignmentListQuerySchema),
  (req, res) => assignmentController.listAssignments(req as AuthenticatedRequest, res)
);

router.get('/:assignment_code',
  authenticateToken,
  assignmentQueryRateLimiter,
  validateParams(assignmentCodeParamSchema),
  (req, res) => assignmentController.getAssignmentDetails(req as AuthenticatedRequest, res)
);

// Admin only routes
router.post('/',
  authenticateToken,
  requireAdmin,
  validateRequestBody(createAssignmentSchema),
  assignmentController.createAssignment.bind(assignmentController)
);

router.put('/:assignment_code',
  authenticateToken,
  requireAdmin,
  validateParams(assignmentCodeParamSchema),
  validateRequestBody(updateAssignmentSchema),
  assignmentController.updateAssignment.bind(assignmentController)
);

router.delete('/:assignment_code',
  authenticateToken,
  requireAdmin,
  validateParams(assignmentCodeParamSchema),
  assignmentController.deleteAssignment.bind(assignmentController)
);

router.get('/:assignment_code/stats',
  authenticateToken,
  requireAdmin,
  validateParams(assignmentCodeParamSchema),
  assignmentController.getAssignmentStats.bind(assignmentController)
);

export default router;