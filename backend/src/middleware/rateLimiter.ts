import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { ErrorCodes, ErrorMessages } from '../utils/errors';

// Create rate limiter configurations
const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
        message,
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message,
          details: {
            limit: max,
            window: windowMs / 1000,
            retryAfter: Math.ceil(windowMs / 1000),
          },
          timestamp: new Date().toISOString(),
        },
      });
    },
  });
};

// General API rate limiter
export const rateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  '일반 API 요청 한도를 초과했습니다. 15분 후 다시 시도해주세요.'
);

// Submission rate limiter (more restrictive)
export const submissionRateLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 submissions per hour
  '제출 한도를 초과했습니다. 1시간 후 다시 시도해주세요.'
);

// Feedback request rate limiter
export const feedbackRateLimiter = createRateLimiter(
  10 * 60 * 1000, // 10 minutes
  20, // 20 feedback requests per 10 minutes
  '피드백 조회 한도를 초과했습니다. 10분 후 다시 시도해주세요.'
);

// Assignment query rate limiter
export const assignmentQueryRateLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  30, // 30 requests per minute
  '조회 한도를 초과했습니다. 1분 후 다시 시도해주세요.'
);

// AI feedback generation rate limiter (global, not per IP)
let aiRequestCount = 0;
let aiRequestResetTime = Date.now() + 60 * 60 * 1000; // 1 hour from now

export const aiRateLimiter = (req: Request, res: Response, next: Function) => {
  const now = Date.now();
  
  // Reset counter if time window has passed
  if (now > aiRequestResetTime) {
    aiRequestCount = 0;
    aiRequestResetTime = now + 60 * 60 * 1000;
  }
  
  // Check if limit exceeded
  if (aiRequestCount >= 100) {
    return res.status(429).json({
      success: false,
      error: {
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
        message: 'AI 피드백 생성 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
        details: {
          limit: 100,
          window: 3600,
          retryAfter: Math.ceil((aiRequestResetTime - now) / 1000),
        },
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  aiRequestCount++;
  next();
};

// Authentication rate limiter (for login attempts)
export const authRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 login attempts per 15 minutes
  '로그인 시도 한도를 초과했습니다. 15분 후 다시 시도해주세요.'
);