import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface JWTPayload {
  sub: string; // Discord user ID
  username: string;
  role: 'student' | 'admin';
  iat: number;
  exp: number;
  guild_id?: string; // Discord server ID
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

/**
 * Verify JWT token and attach user info to request
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    throw new UnauthorizedError('토큰이 필요합니다.');
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('JWT_SECRET environment variable is not set');
      throw new Error('JWT configuration error');
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    // Check if token is expired
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      throw new UnauthorizedError('토큰이 만료되었습니다. 다시 로그인해주세요.');
    }

    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('유효하지 않은 토큰입니다.');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('토큰이 만료되었습니다. 다시 로그인해주세요.');
    }
    throw error;
  }
}

/**
 * Check if user has admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user) {
    throw new UnauthorizedError('인증이 필요합니다.');
  }
  
  if (user.role !== 'admin') {
    throw new ForbiddenError('관리자 권한이 필요합니다.');
  }
  
  next();
}

/**
 * Check if user can access specific resource (student can only access their own data)
 */
export function requireOwnershipOrAdmin(
  getUserIdFromParams: (req: Request) => string
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    
    if (!user) {
      throw new UnauthorizedError('인증이 필요합니다.');
    }
    
    // Admin can access any resource
    if (user.role === 'admin') {
      next();
      return;
    }
    
    // Students can only access their own resources
    const resourceUserId = getUserIdFromParams(req);
    if (user.sub !== resourceUserId) {
      throw new ForbiddenError('본인의 데이터만 접근할 수 있습니다.');
    }
    
    next();
  };
}

/**
 * Create and sign JWT token
 */
export function createJWTToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const tokenPayload: JWTPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  };

  return jwt.sign(tokenPayload, secret);
}

/**
 * Refresh JWT token
 */
export function refreshJWTToken(token: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  try {
    // Verify the token (even if expired, we want to refresh it)
    const decoded = jwt.verify(token, secret, { ignoreExpiration: true }) as JWTPayload;
    
    // Check if the token is too old to refresh (more than 30 days)
    const tokenAge = Date.now() / 1000 - decoded.iat;
    if (tokenAge > 30 * 24 * 60 * 60) {
      throw new UnauthorizedError('토큰이 너무 오래되었습니다. 다시 로그인해주세요.');
    }

    // Create new token with same payload but new timestamps
    const newPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: decoded.sub,
      username: decoded.username,
      role: decoded.role,
      guild_id: decoded.guild_id,
    };

    return createJWTToken(newPayload);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('유효하지 않은 토큰입니다.');
    }
    throw error;
  }
}

/**
 * Optional authentication middleware - doesn't throw error if no token
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      next();
      return;
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;
    (req as AuthenticatedRequest).user = decoded;
  } catch (error) {
    // Log the error but don't throw - this is optional auth
    logger.warn('Optional auth failed:', error instanceof Error ? error.message : error);
  }

  next();
}