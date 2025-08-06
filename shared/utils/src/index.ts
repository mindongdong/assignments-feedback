// Assignment code generation and validation utilities
const ASSIGNMENT_CODE_LENGTH = 6;
const ASSIGNMENT_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a random 6-character assignment code
 * Format: [A-Z0-9]{6} (e.g., ABC123, X9Y8Z7)
 */
export function generateAssignmentCode(): string {
  let code = '';
  for (let i = 0; i < ASSIGNMENT_CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * ASSIGNMENT_CODE_CHARS.length);
    code += ASSIGNMENT_CODE_CHARS[randomIndex];
  }
  return code;
}

/**
 * Validate assignment code format
 */
export function isValidAssignmentCode(code: string): boolean {
  const regex = new RegExp(`^[A-Z0-9]{${ASSIGNMENT_CODE_LENGTH}}$`);
  return regex.test(code);
}

/**
 * Format date to Korean locale string
 */
export function formatKoreanDate(date: Date): string {
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Check if submission is late
 */
export function isLateSubmission(deadline: Date, submittedAt: Date): boolean {
  return submittedAt > deadline;
}

/**
 * Calculate days until deadline
 */
export function daysUntilDeadline(deadline: Date): number {
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Extract GitHub repository information from URL
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
  const match = url.match(regex);
  
  if (match && match[1] && match[2]) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
    };
  }
  
  return null;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Truncate content for preview
 */
export function truncateContent(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}

/**
 * Format error message for Discord
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `❌ 오류가 발생했습니다: ${error.message}`;
  }
  return '❌ 알 수 없는 오류가 발생했습니다.';
}

/**
 * Generate submission ID format
 */
export function formatSubmissionId(id: string): string {
  return `SUB-${id.substring(0, 8).toUpperCase()}`;
}

/**
 * Calculate overall score from individual scores
 */
export function calculateOverallScore(scores: {
  requirementsFulfillment: number;
  codeQuality: number;
  bestPractices: number;
  creativity: number;
}): number {
  const weights = {
    requirementsFulfillment: 0.4,
    codeQuality: 0.3,
    bestPractices: 0.2,
    creativity: 0.1,
  };

  const weightedSum = 
    scores.requirementsFulfillment * weights.requirementsFulfillment +
    scores.codeQuality * weights.codeQuality +
    scores.bestPractices * weights.bestPractices +
    scores.creativity * weights.creativity;

  return Math.round(weightedSum * 10) / 10; // Round to 1 decimal place
}