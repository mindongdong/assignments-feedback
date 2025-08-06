import { logger } from './logger';

/**
 * 과제 코드 형식 검증 (6자리 영문 대문자와 숫자)
 */
export function validateAssignmentCode(code: string): { isValid: boolean; error?: string } {
  if (!code) {
    return { isValid: false, error: '과제 코드가 필요합니다.' };
  }

  if (typeof code !== 'string') {
    return { isValid: false, error: '과제 코드는 문자열이어야 합니다.' };
  }

  const cleanCode = code.trim().toUpperCase();

  if (cleanCode.length !== 6) {
    return { isValid: false, error: '과제 코드는 6자리여야 합니다.' };
  }

  if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
    return { isValid: false, error: '과제 코드는 영문 대문자와 숫자만 포함해야 합니다.' };
  }

  return { isValid: true };
}

/**
 * GitHub URL 형식 검증
 */
export function validateGitHubUrl(url: string): { isValid: boolean; error?: string } {
  if (!url) {
    return { isValid: false, error: 'GitHub URL이 필요합니다.' };
  }

  if (typeof url !== 'string') {
    return { isValid: false, error: 'GitHub URL은 문자열이어야 합니다.' };
  }

  try {
    const parsedUrl = new URL(url.trim());
    
    // Check if it's a GitHub URL
    if (parsedUrl.hostname !== 'github.com') {
      return { isValid: false, error: 'GitHub URL이어야 합니다 (github.com).' };
    }

    // Check URL pattern: https://github.com/username/repository
    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    
    if (pathParts.length < 2) {
      return { isValid: false, error: '올바른 GitHub 저장소 URL 형식이 아닙니다.' };
    }

    // Basic validation for username and repository name
    const username = pathParts[0];
    const repository = pathParts[1];

    if (!/^[a-zA-Z0-9-_.]+$/.test(username)) {
      return { isValid: false, error: '유효하지 않은 GitHub 사용자명입니다.' };
    }

    if (!/^[a-zA-Z0-9-_.]+$/.test(repository)) {
      return { isValid: false, error: '유효하지 않은 GitHub 저장소명입니다.' };
    }

    return { isValid: true };

  } catch (error) {
    return { isValid: false, error: '유효하지 않은 URL 형식입니다.' };
  }
}

/**
 * 제출 내용 검증
 */
export function validateSubmissionContent(content: string): { isValid: boolean; error?: string } {
  if (!content) {
    return { isValid: false, error: '제출 내용이 필요합니다.' };
  }

  if (typeof content !== 'string') {
    return { isValid: false, error: '제출 내용은 문자열이어야 합니다.' };
  }

  const trimmedContent = content.trim();

  if (trimmedContent.length === 0) {
    return { isValid: false, error: '제출 내용이 비어있습니다.' };
  }

  if (trimmedContent.length > 10000) {
    return { isValid: false, error: '제출 내용이 너무 깁니다 (최대 10,000자).' };
  }

  return { isValid: true };
}

/**
 * 페이지 번호 검증
 */
export function validatePageNumber(page: number | string): { isValid: boolean; value?: number; error?: string } {
  let pageNum: number;

  if (typeof page === 'string') {
    pageNum = parseInt(page, 10);
    if (isNaN(pageNum)) {
      return { isValid: false, error: '페이지 번호는 숫자여야 합니다.' };
    }
  } else if (typeof page === 'number') {
    pageNum = page;
  } else {
    return { isValid: false, error: '페이지 번호는 숫자여야 합니다.' };
  }

  if (pageNum < 1) {
    return { isValid: false, error: '페이지 번호는 1 이상이어야 합니다.' };
  }

  if (pageNum > 1000) {
    return { isValid: false, error: '페이지 번호는 1000 이하여야 합니다.' };
  }

  return { isValid: true, value: pageNum };
}

/**
 * Discord 사용자 ID 검증
 */
export function validateDiscordId(id: string): { isValid: boolean; error?: string } {
  if (!id) {
    return { isValid: false, error: 'Discord ID가 필요합니다.' };
  }

  if (typeof id !== 'string') {
    return { isValid: false, error: 'Discord ID는 문자열이어야 합니다.' };
  }

  // Discord user IDs are 17-19 digit numbers (as strings)
  if (!/^\d{17,19}$/.test(id)) {
    return { isValid: false, error: '유효하지 않은 Discord ID 형식입니다.' };
  }

  return { isValid: true };
}

/**
 * 명령어 인수 검증 로깅
 */
export function logValidationError(commandName: string, field: string, error: string, userId?: string): void {
  logger.warn(`명령어 '${commandName}' 검증 실패`, {
    field,
    error,
    userId,
  });
}

/**
 * 일반적인 입력값 정리
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML/markdown injection
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * 한국어 텍스트 검증 (선택적)
 */
export function validateKoreanText(text: string): { isValid: boolean; error?: string } {
  if (!text || typeof text !== 'string') {
    return { isValid: false, error: '텍스트가 필요합니다.' };
  }

  const trimmedText = text.trim();

  if (trimmedText.length === 0) {
    return { isValid: false, error: '텍스트가 비어있습니다.' };
  }

  // Check for basic Korean characters (optional)
  const hasKorean = /[가-힣]/.test(trimmedText);
  const hasEnglish = /[a-zA-Z]/.test(trimmedText);

  if (!hasKorean && !hasEnglish) {
    return { isValid: false, error: '한국어 또는 영어 텍스트가 필요합니다.' };
  }

  return { isValid: true };
}