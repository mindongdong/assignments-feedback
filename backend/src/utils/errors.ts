export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(code: string, message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Predefined error types
export class ValidationError extends ApplicationError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource}를 찾을 수 없습니다: ${identifier}`
      : `${resource}를 찾을 수 없습니다.`;
    super('NOT_FOUND', message, 404, { resource, identifier });
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string, details?: any) {
    super('CONFLICT', message, 409, details);
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message: string = '인증이 필요합니다.') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message: string = '권한이 없습니다.') {
    super('FORBIDDEN', message, 403);
  }
}

export class RateLimitError extends ApplicationError {
  constructor(retryAfter: number) {
    super(
      'RATE_LIMIT_EXCEEDED', 
      `요청 한도를 초과했습니다. ${retryAfter}초 후 다시 시도해주세요.`, 
      429, 
      { retryAfter }
    );
  }
}

export class ExternalServiceError extends ApplicationError {
  constructor(service: string, message: string, details?: any) {
    super(
      'EXTERNAL_SERVICE_ERROR', 
      `${service} 서비스 오류: ${message}`, 
      502, 
      { service, ...details }
    );
  }
}

// Error code constants
export const ErrorCodes = {
  // Authentication
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_ASSIGNMENT_CODE: 'INVALID_ASSIGNMENT_CODE',
  ASSIGNMENT_NOT_FOUND: 'ASSIGNMENT_NOT_FOUND',
  ASSIGNMENT_CLOSED: 'ASSIGNMENT_CLOSED',
  DUPLICATE_SUBMISSION: 'DUPLICATE_SUBMISSION',
  DUPLICATE_VALUE: 'DUPLICATE_VALUE',
  INVALID_REFERENCE: 'INVALID_REFERENCE',
  
  // External Services
  GITHUB_ACCESS_FAILED: 'GITHUB_ACCESS_FAILED',
  CONTENT_FETCH_FAILED: 'CONTENT_FETCH_FAILED',
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  
  // System
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
} as const;

// Korean error messages
export const ErrorMessages = {
  [ErrorCodes.INVALID_TOKEN]: '유효하지 않은 토큰입니다.',
  [ErrorCodes.TOKEN_EXPIRED]: '토큰이 만료되었습니다. 다시 로그인해주세요.',
  [ErrorCodes.UNAUTHORIZED]: '인증이 필요합니다.',
  [ErrorCodes.FORBIDDEN]: '권한이 없습니다.',
  
  [ErrorCodes.VALIDATION_ERROR]: '입력값이 올바르지 않습니다.',
  [ErrorCodes.INVALID_ASSIGNMENT_CODE]: '과제 코드 형식이 올바르지 않습니다. 6자리 영문/숫자 조합을 입력해주세요.',
  [ErrorCodes.ASSIGNMENT_NOT_FOUND]: '과제를 찾을 수 없습니다. 과제 코드를 확인해주세요.',
  [ErrorCodes.ASSIGNMENT_CLOSED]: '마감된 과제입니다.',
  [ErrorCodes.DUPLICATE_SUBMISSION]: '이미 제출한 과제입니다.',
  
  [ErrorCodes.GITHUB_ACCESS_FAILED]: 'GitHub 저장소에 접근할 수 없습니다. 저장소가 공개되어 있는지 확인해주세요.',
  [ErrorCodes.CONTENT_FETCH_FAILED]: '내용을 가져올 수 없습니다. URL을 확인해주세요.',
  [ErrorCodes.AI_SERVICE_UNAVAILABLE]: 'AI 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.',
  
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  [ErrorCodes.INTERNAL_SERVER_ERROR]: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  [ErrorCodes.DATABASE_ERROR]: '데이터베이스 오류가 발생했습니다.',
  [ErrorCodes.CACHE_ERROR]: '캐시 오류가 발생했습니다.',
} as const;