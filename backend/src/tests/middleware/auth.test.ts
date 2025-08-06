import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import {
  authenticateToken,
  createJWTToken,
  refreshJWTToken,
  requireAdmin,
  JWTPayload,
} from '../../middleware/auth';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';

describe('Auth Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', () => {
      const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
        sub: 'user-id',
        username: 'testuser',
        role: 'student',
      };
      
      const token = createJWTToken(payload);
      req.headers!.authorization = `Bearer ${token}`;

      authenticateToken(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).user).toBeDefined();
      expect((req as any).user.sub).toBe('user-id');
    });

    it('should throw error for missing token', () => {
      expect(() => {
        authenticateToken(req as Request, res as Response, next);
      }).toThrow(UnauthorizedError);
    });

    it('should throw error for invalid token', () => {
      req.headers!.authorization = 'Bearer invalid-token';

      expect(() => {
        authenticateToken(req as Request, res as Response, next);
      }).toThrow(UnauthorizedError);
    });

    it('should throw error for expired token', () => {
      const expiredToken = jwt.sign(
        { 
          sub: 'user-id', 
          username: 'testuser', 
          role: 'student',
          exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
        },
        process.env.JWT_SECRET!
      );
      
      req.headers!.authorization = `Bearer ${expiredToken}`;

      expect(() => {
        authenticateToken(req as Request, res as Response, next);
      }).toThrow(UnauthorizedError);
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin users', () => {
      (req as any).user = {
        sub: 'admin-id',
        username: 'admin',
        role: 'admin',
      };

      requireAdmin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject non-admin users', () => {
      (req as any).user = {
        sub: 'user-id',
        username: 'testuser',
        role: 'student',
      };

      expect(() => {
        requireAdmin(req as Request, res as Response, next);
      }).toThrow(ForbiddenError);
    });

    it('should reject requests without user', () => {
      expect(() => {
        requireAdmin(req as Request, res as Response, next);
      }).toThrow(UnauthorizedError);
    });
  });

  describe('createJWTToken', () => {
    it('should create valid JWT token', () => {
      const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
        sub: 'user-id',
        username: 'testuser',
        role: 'student',
      };

      const token = createJWTToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

      // Verify token can be decoded
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      expect(decoded.sub).toBe('user-id');
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('student');
    });
  });

  describe('refreshJWTToken', () => {
    it('should refresh valid token', () => {
      const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
        sub: 'user-id',
        username: 'testuser',
        role: 'student',
      };

      const originalToken = createJWTToken(payload);
      const refreshedToken = refreshJWTToken(originalToken);

      expect(typeof refreshedToken).toBe('string');
      expect(refreshedToken).not.toBe(originalToken);

      // Verify refreshed token has same payload
      const decoded = jwt.verify(refreshedToken, process.env.JWT_SECRET!) as JWTPayload;
      expect(decoded.sub).toBe('user-id');
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('student');
    });

    it('should reject very old tokens', () => {
      const oldToken = jwt.sign(
        {
          sub: 'user-id',
          username: 'testuser',
          role: 'student',
          iat: Math.floor(Date.now() / 1000) - (31 * 24 * 60 * 60), // 31 days ago
          exp: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // 30 days ago
        },
        process.env.JWT_SECRET!
      );

      expect(() => {
        refreshJWTToken(oldToken);
      }).toThrow(UnauthorizedError);
    });
  });
});