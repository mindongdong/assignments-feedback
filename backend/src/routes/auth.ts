import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { validateRequestBody } from '../utils/validation';
import Joi from 'joi';
import { prisma, cacheService } from '../index';

const router = Router();
const authController = new AuthController(prisma, cacheService);

// Validation schemas
const discordLoginSchema = Joi.object({
  code: Joi.string().required().messages({
    'string.empty': 'Discord 인증 코드가 필요합니다.',
  }),
  redirect_uri: Joi.string().uri().optional(),
});

const updateRoleSchema = Joi.object({
  role: Joi.string().valid('student', 'admin').required().messages({
    'any.only': '역할은 student 또는 admin이어야 합니다.',
    'string.empty': '역할을 선택해주세요.',
  }),
});

// Public routes
router.get('/discord/url', authController.getDiscordAuthUrl.bind(authController));

// Authentication routes with rate limiting
router.post('/discord/login', 
  authRateLimiter,
  validateRequestBody(discordLoginSchema),
  authController.discordLogin.bind(authController)
);

router.post('/discord/callback',
  authRateLimiter,
  validateRequestBody(discordLoginSchema),
  authController.discordCallback.bind(authController)
);

// Protected routes
router.post('/refresh',
  authenticateToken,
  authController.refreshToken.bind(authController)
);

router.delete('/logout',
  authenticateToken,
  authController.logout.bind(authController)
);

router.get('/me',
  authenticateToken,
  authController.getCurrentUser.bind(authController)
);

// Admin only routes
router.put('/users/:user_id/role',
  authenticateToken,
  requireAdmin,
  validateRequestBody(updateRoleSchema),
  authController.updateUserRole.bind(authController)
);

router.get('/users',
  authenticateToken,
  requireAdmin,
  authController.getAllUsers.bind(authController)
);

export default router;