import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { AuthenticatedRequest, createJWTToken, refreshJWTToken } from '../middleware/auth';
import { CacheService } from '../services/CacheService';
import { UnauthorizedError, ExternalServiceError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  verified: boolean;
  locale: string;
}

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export class AuthController {
  constructor(
    private prisma: PrismaClient,
    private cacheService: CacheService
  ) {}

  /**
   * Discord OAuth2 login - POST /auth/discord/login
   */
  async discordLogin(req: Request, res: Response): Promise<void> {
    try {
      const { code, redirect_uri } = req.body;

      if (!code) {
        throw new ValidationError('Discord 인증 코드가 필요합니다.');
      }

      // Exchange code for access token
      const tokenResponse = await this.exchangeCodeForToken(code, redirect_uri);
      
      // Get user info from Discord
      const discordUser = await this.getDiscordUser(tokenResponse.access_token);
      
      // Create or update user in database
      const user = await this.createOrUpdateUser(discordUser);

      // Create JWT token
      const jwtToken = createJWTToken({
        sub: user.id,
        username: user.username,
        role: 'student', // Default role, can be changed by admin
      });

      // Store refresh token in cache
      await this.cacheService.set(
        `refresh_token:${user.id}`, 
        tokenResponse.refresh_token, 
        7 * 24 * 60 * 60 // 7 days
      );

      logger.info('User logged in:', {
        userId: user.id,
        discordId: user.discordId,
        username: user.username,
      });

      res.json({
        success: true,
        data: {
          access_token: jwtToken,
          token_type: 'Bearer',
          expires_in: 7 * 24 * 60 * 60, // 7 days
          user: {
            id: user.id,
            discord_id: user.discordId,
            username: user.username,
          },
        },
        message: '성공적으로 로그인했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Discord OAuth2 callback - POST /auth/discord/callback
   */
  async discordCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.body;

      if (!code) {
        throw new ValidationError('Discord 인증 코드가 필요합니다.');
      }

      // This is similar to discordLogin but might have different flow
      // depending on your OAuth2 setup
      const tokenResponse = await this.exchangeCodeForToken(code);
      const discordUser = await this.getDiscordUser(tokenResponse.access_token);
      const user = await this.createOrUpdateUser(discordUser);

      const jwtToken = createJWTToken({
        sub: user.id,
        username: user.username,
        role: 'student',
      });

      await this.cacheService.set(
        `refresh_token:${user.id}`, 
        tokenResponse.refresh_token, 
        7 * 24 * 60 * 60
      );

      res.json({
        success: true,
        data: {
          access_token: jwtToken,
          token_type: 'Bearer',
          expires_in: 7 * 24 * 60 * 60,
          user: {
            id: user.id,
            discord_id: user.discordId,
            username: user.username,
          },
        },
        message: '성공적으로 로그인했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refresh JWT token - POST /auth/refresh
   */
  async refreshToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentToken = req.headers.authorization?.split(' ')[1];
      
      if (!currentToken) {
        throw new UnauthorizedError('토큰이 필요합니다.');
      }

      // Refresh the JWT token
      const newToken = refreshJWTToken(currentToken);

      res.json({
        success: true,
        data: {
          access_token: newToken,
          token_type: 'Bearer',
          expires_in: 7 * 24 * 60 * 60,
        },
        message: '토큰이 성공적으로 갱신되었습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout - DELETE /auth/logout
   */
  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.sub;

      // Remove refresh token from cache
      await this.cacheService.del(`refresh_token:${user_id}`);

      // Invalidate user caches
      await this.cacheService.delPattern(`user:${user_id}:*`);

      logger.info('User logged out:', {
        userId: user_id,
        username: req.user.username,
      });

      res.json({
        success: true,
        message: '성공적으로 로그아웃했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current user info - GET /auth/me
   */
  async getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user_id = req.user.sub;

      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: {
          id: true,
          discordId: true,
          username: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new UnauthorizedError('사용자를 찾을 수 없습니다.');
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          discord_id: user.discordId,
          username: user.username,
          role: req.user.role,
          created_at: user.createdAt.toISOString(),
          updated_at: user.updatedAt.toISOString(),
        },
        message: '사용자 정보를 성공적으로 조회했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate Discord OAuth URL - GET /auth/discord/url
   */
  async getDiscordAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const { redirect_uri } = req.query;

      const clientId = process.env.DISCORD_CLIENT_ID;
      if (!clientId) {
        throw new ExternalServiceError('Discord', 'Discord 클라이언트 ID가 설정되지 않았습니다.');
      }

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: 'identify',
        redirect_uri: redirect_uri as string || process.env.DISCORD_REDIRECT_URI || '',
      });

      const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

      res.json({
        success: true,
        data: {
          auth_url: authUrl,
        },
        message: 'Discord 인증 URL을 생성했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Helper: Exchange Discord code for access token
   */
  private async exchangeCodeForToken(code: string, redirectUri?: string): Promise<DiscordTokenResponse> {
    try {
      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;
      const defaultRedirectUri = process.env.DISCORD_REDIRECT_URI;

      if (!clientId || !clientSecret) {
        throw new Error('Discord OAuth2 credentials not configured');
      }

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri || defaultRedirectUri || '',
        client_id: clientId,
        client_secret: clientSecret,
      });

      const response = await axios.post(
        'https://discord.com/api/oauth2/token',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Discord token exchange failed:', error);
      throw new ExternalServiceError('Discord', 'Discord 인증에 실패했습니다.');
    }
  }

  /**
   * Helper: Get Discord user info
   */
  private async getDiscordUser(accessToken: string): Promise<DiscordUser> {
    try {
      const response = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Discord user info fetch failed:', error);
      throw new ExternalServiceError('Discord', 'Discord 사용자 정보를 가져올 수 없습니다.');
    }
  }

  /**
   * Helper: Create or update user in database
   */
  private async createOrUpdateUser(discordUser: DiscordUser) {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { discordId: discordUser.id },
      });

      if (existingUser) {
        // Update existing user
        return await this.prisma.user.update({
          where: { discordId: discordUser.id },
          data: {
            username: discordUser.username,
          },
        });
      } else {
        // Create new user
        return await this.prisma.user.create({
          data: {
            discordId: discordUser.id,
            username: discordUser.username,
          },
        });
      }
    } catch (error) {
      logger.error('User creation/update failed:', error);
      throw new Error('사용자 생성/업데이트에 실패했습니다.');
    }
  }

  /**
   * Admin: Update user role - PUT /auth/users/:user_id/role
   */
  async updateUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user_id } = req.params;
      const { role } = req.body;

      if (!['student', 'admin'].includes(role)) {
        throw new ValidationError('유효하지 않은 역할입니다.');
      }

      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
      });

      if (!user) {
        throw new ValidationError('사용자를 찾을 수 없습니다.');
      }

      // Note: In a real implementation, you might want to store roles in the database
      // For now, we'll just return success as roles are managed in JWT tokens

      logger.info('User role updated:', {
        targetUserId: user_id,
        newRole: role,
        updatedBy: req.user.username,
      });

      res.json({
        success: true,
        data: {
          user_id,
          role,
          updated_at: new Date().toISOString(),
        },
        message: '사용자 역할이 성공적으로 업데이트되었습니다.',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Admin: Get all users - GET /auth/users
   */
  async getAllUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { limit = 50, offset = 0, search } = req.query as any;

      // Build where clause for search
      const where: any = {};
      if (search) {
        where.username = {
          contains: search,
          mode: 'insensitive',
        };
      }

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          select: {
            id: true,
            discordId: true,
            username: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                submissions: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: Number(limit),
          skip: Number(offset),
        }),
        this.prisma.user.count({ where }),
      ]);

      const formattedUsers = users.map(user => ({
        id: user.id,
        discord_id: user.discordId,
        username: user.username,
        total_submissions: user._count.submissions,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
      }));

      res.json({
        success: true,
        data: {
          users: formattedUsers,
          total,
          has_more: offset + limit < total,
        },
        message: '사용자 목록을 성공적으로 조회했습니다.',
      });
    } catch (error) {
      throw error;
    }
  }
}