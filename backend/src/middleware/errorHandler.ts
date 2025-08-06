import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ApplicationError, ErrorCodes, ErrorMessages } from '../utils/errors';
import { logger } from '../utils/logger';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Handle known application errors
  if (error instanceof ApplicationError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
      },
    };

    res.status(error.statusCode).json(response);
    return;
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let statusCode = 400;
    let code: string = ErrorCodes.DATABASE_ERROR;
    let message: string = ErrorMessages[ErrorCodes.DATABASE_ERROR];
    let details: any = undefined;

    switch (error.code) {
      case 'P2002': // Unique constraint violation
        statusCode = 409;
        code = ErrorCodes.DUPLICATE_VALUE;
        message = '중복된 값입니다.';
        details = {
          fields: error.meta?.target,
        };
        break;

      case 'P2025': // Record not found
        statusCode = 404;
        code = ErrorCodes.ASSIGNMENT_NOT_FOUND;
        message = '요청한 데이터를 찾을 수 없습니다.';
        break;

      case 'P2003': // Foreign key constraint violation
        statusCode = 400;
        code = ErrorCodes.INVALID_REFERENCE;
        message = '참조하는 데이터가 존재하지 않습니다.';
        break;

      case 'P2014': // Invalid ID
        statusCode = 400;
        code = ErrorCodes.VALIDATION_ERROR;
        message = '유효하지 않은 ID입니다.';
        break;

      default:
        logger.error('Unhandled Prisma error:', error);
    }

    const response: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
    };

    res.status(statusCode).json(response);
    return;
  }

  // Handle Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: '데이터 유효성 검사에 실패했습니다.',
        timestamp: new Date().toISOString(),
      },
    };

    res.status(400).json(response);
    return;
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && 'body' in error) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'JSON 형식이 올바르지 않습니다.',
        timestamp: new Date().toISOString(),
      },
    };

    res.status(400).json(response);
    return;
  }

  // Handle rate limit errors
  if (error.message === 'Too many requests') {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
        message: ErrorMessages[ErrorCodes.RATE_LIMIT_EXCEEDED],
        timestamp: new Date().toISOString(),
      },
    };

    res.status(429).json(response);
    return;
  }

  // Default internal server error
  const response: ErrorResponse = {
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: ErrorMessages[ErrorCodes.INTERNAL_SERVER_ERROR],
      timestamp: new Date().toISOString(),
    },
  };

  res.status(500).json(response);
}