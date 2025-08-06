/**
 * 6-character alphanumeric assignment code utilities
 * Optimized for Discord bot performance and Korean user experience
 */

import { logger } from './logger';

// Character set for assignment codes (excluding confusing characters)
const CHARSET = '0123456789ABCDEFGHIJKLMNPQRSTUVWXYZ'; // Excluded O, I for clarity
const CODE_LENGTH = 6;

/**
 * Generate a random 6-character alphanumeric assignment code
 */
export function generateAssignmentCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    code += CHARSET[randomIndex];
  }
  return code;
}

/**
 * Validate assignment code format
 */
export function validateAssignmentCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // Check length
  if (code.length !== CODE_LENGTH) {
    return false;
  }

  // Check if all characters are valid
  return code.split('').every(char => CHARSET.includes(char.toUpperCase()));
}

/**
 * Sanitize and normalize assignment code input
 */
export function sanitizeAssignmentCode(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Remove whitespace and convert to uppercase
  const sanitized = input.trim().toUpperCase();

  // Replace commonly confused characters
  const normalized = sanitized
    .replace(/O/g, '0')  // Replace O with 0
    .replace(/I/g, '1')  // Replace I with 1
    .replace(/L/g, '1'); // Replace L with 1

  if (!validateAssignmentCode(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Generate multiple unique assignment codes
 */
export function generateMultipleAssignmentCodes(count: number): string[] {
  const codes = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 10; // Prevent infinite loops

  while (codes.size < count && attempts < maxAttempts) {
    codes.add(generateAssignmentCode());
    attempts++;
  }

  if (codes.size < count) {
    logger.warn(`Could only generate ${codes.size} unique codes out of ${count} requested`);
  }

  return Array.from(codes);
}

/**
 * Check if assignment code is in valid format for Discord display
 */
export function formatAssignmentCodeForDiscord(code: string): string {
  const sanitized = sanitizeAssignmentCode(code);
  if (!sanitized) {
    return '잘못된 과제 코드';
  }

  // Format as: ABC-123 for better readability
  return `${sanitized.substring(0, 3)}-${sanitized.substring(3)}`;
}

/**
 * Parse assignment code from Discord formatted input
 */
export function parseAssignmentCodeFromDiscord(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Remove common formatting characters
  const cleaned = input
    .replace(/[-_\s]/g, '') // Remove dashes, underscores, spaces
    .trim()
    .toUpperCase();

  return sanitizeAssignmentCode(cleaned);
}

/**
 * Generate Korean-friendly error messages for invalid codes
 */
export function getAssignmentCodeErrorMessage(input: string): string {
  if (!input || typeof input !== 'string' || input.trim().length === 0) {
    return '과제 코드를 입력해주세요.';
  }

  const trimmed = input.trim();
  
  if (trimmed.length < CODE_LENGTH) {
    return `과제 코드는 ${CODE_LENGTH}자리여야 합니다. (현재: ${trimmed.length}자리)`;
  }

  if (trimmed.length > CODE_LENGTH) {
    return `과제 코드는 ${CODE_LENGTH}자리여야 합니다. (현재: ${trimmed.length}자리)`;
  }

  // Check for invalid characters
  const invalidChars = trimmed
    .toUpperCase()
    .split('')
    .filter(char => !CHARSET.includes(char));

  if (invalidChars.length > 0) {
    return `잘못된 문자가 포함되어 있습니다: ${invalidChars.join(', ')}`;
  }

  return '알 수 없는 오류입니다. 다시 시도해주세요.';
}

/**
 * Calculate assignment code collision probability
 */
export function calculateCollisionProbability(existingCodes: number): number {
  const totalPossible = Math.pow(CHARSET.length, CODE_LENGTH);
  return (existingCodes / totalPossible) * 100;
}

/**
 * Suggest similar assignment codes for typos
 */
export function suggestSimilarCodes(input: string, validCodes: string[]): string[] {
  const sanitized = sanitizeAssignmentCode(input);
  if (!sanitized) {
    return [];
  }

  const suggestions: Array<{ code: string; distance: number }> = [];

  for (const validCode of validCodes) {
    const distance = calculateLevenshteinDistance(sanitized, validCode);
    if (distance <= 2) { // Allow up to 2 character differences
      suggestions.push({ code: validCode, distance });
    }
  }

  // Sort by similarity (lower distance = more similar)
  return suggestions
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3) // Return top 3 suggestions
    .map(s => s.code);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Validate assignment code with detailed feedback
 */
export interface AssignmentCodeValidation {
  isValid: boolean;
  sanitized?: string;
  error?: string;
  suggestions?: string[];
}

export function validateAssignmentCodeDetailed(
  input: string, 
  existingCodes?: string[]
): AssignmentCodeValidation {
  try {
    const sanitized = sanitizeAssignmentCode(input);
    
    if (!sanitized) {
      const error = getAssignmentCodeErrorMessage(input);
      const suggestions = existingCodes ? suggestSimilarCodes(input, existingCodes) : [];
      
      return {
        isValid: false,
        error,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };
    }

    return {
      isValid: true,
      sanitized,
    };
  } catch (error) {
    logger.error('Assignment code validation error:', error);
    return {
      isValid: false,
      error: '과제 코드 검증 중 오류가 발생했습니다.',
    };
  }
}

/**
 * Generate assignment code with retry logic
 */
export async function generateUniqueAssignmentCode(
  checkExistence: (code: string) => Promise<boolean>,
  maxAttempts: number = 10
): Promise<string> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const code = generateAssignmentCode();
    const exists = await checkExistence(code);
    
    if (!exists) {
      return code;
    }
    
    attempts++;
  }
  
  throw new Error(`Failed to generate unique assignment code after ${maxAttempts} attempts`);
}

export default {
  generateAssignmentCode,
  validateAssignmentCode,
  sanitizeAssignmentCode,
  generateMultipleAssignmentCodes,
  formatAssignmentCodeForDiscord,
  parseAssignmentCodeFromDiscord,
  getAssignmentCodeErrorMessage,
  calculateCollisionProbability,
  suggestSimilarCodes,
  validateAssignmentCodeDetailed,
  generateUniqueAssignmentCode,
};