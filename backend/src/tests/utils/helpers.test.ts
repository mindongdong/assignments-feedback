import {
  generateAssignmentCode,
  isValidAssignmentCode,
  getTimeRemaining,
  isSubmissionLate,
  sanitizeContent,
  extractDomain,
  parseGitHubUrl,
  isDeadlineApproaching,
} from '../../utils/helpers';

describe('Helpers', () => {
  describe('generateAssignmentCode', () => {
    it('should generate a 6-character code', () => {
      const code = generateAssignmentCode();
      expect(code).toHaveLength(6);
    });

    it('should generate codes with valid characters', () => {
      const code = generateAssignmentCode();
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should generate different codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateAssignmentCode());
      }
      expect(codes.size).toBeGreaterThan(90); // Should be mostly unique
    });
  });

  describe('isValidAssignmentCode', () => {
    it('should validate correct assignment codes', () => {
      expect(isValidAssignmentCode('ABC123')).toBe(true);
      expect(isValidAssignmentCode('XYZ789')).toBe(true);
      expect(isValidAssignmentCode('A1B2C3')).toBe(true);
    });

    it('should reject invalid assignment codes', () => {
      expect(isValidAssignmentCode('abc123')).toBe(false); // lowercase
      expect(isValidAssignmentCode('ABC12')).toBe(false); // too short
      expect(isValidAssignmentCode('ABC1234')).toBe(false); // too long
      expect(isValidAssignmentCode('ABC-12')).toBe(false); // invalid character
      expect(isValidAssignmentCode('')).toBe(false); // empty
    });
  });

  describe('getTimeRemaining', () => {
    it('should return correct time remaining', () => {
      const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
      const remaining = getTimeRemaining(future);
      expect(remaining).toContain('2일');
    });

    it('should return "마감됨" for past dates', () => {
      const past = new Date(Date.now() - 1000); // 1 second ago
      const remaining = getTimeRemaining(past);
      expect(remaining).toBe('마감됨');
    });

    it('should handle hours and minutes', () => {
      const future = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      const remaining = getTimeRemaining(future);
      expect(remaining).toContain('시간');
    });
  });

  describe('isSubmissionLate', () => {
    it('should return true for late submissions', () => {
      const deadline = new Date('2024-01-01T12:00:00Z');
      const submittedAt = new Date('2024-01-01T13:00:00Z'); // 1 hour late
      expect(isSubmissionLate(submittedAt, deadline)).toBe(true);
    });

    it('should return false for on-time submissions', () => {
      const deadline = new Date('2024-01-01T12:00:00Z');
      const submittedAt = new Date('2024-01-01T11:00:00Z'); // 1 hour early
      expect(isSubmissionLate(submittedAt, deadline)).toBe(false);
    });
  });

  describe('sanitizeContent', () => {
    it('should remove script tags', () => {
      const content = 'Hello <script>alert("xss")</script> World';
      const sanitized = sanitizeContent(content);
      expect(sanitized).toBe('Hello  World');
    });

    it('should remove iframe tags', () => {
      const content = 'Hello <iframe src="evil.com"></iframe> World';
      const sanitized = sanitizeContent(content);
      expect(sanitized).toBe('Hello  World');
    });

    it('should decode HTML entities', () => {
      const content = 'Hello &amp; World &lt;test&gt;';
      const sanitized = sanitizeContent(content);
      expect(sanitized).toBe('Hello & World <test>');
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
      expect(extractDomain('http://blog.tistory.com/123')).toBe('blog.tistory.com');
      expect(extractDomain('https://velog.io/@user/post')).toBe('velog.io');
    });

    it('should return empty string for invalid URLs', () => {
      expect(extractDomain('not-a-url')).toBe('');
      expect(extractDomain('')).toBe('');
    });
  });

  describe('parseGitHubUrl', () => {
    it('should parse valid GitHub URLs', () => {
      const result = parseGitHubUrl('https://github.com/user/repo');
      expect(result).toEqual({ owner: 'user', repo: 'repo' });
    });

    it('should handle .git extension', () => {
      const result = parseGitHubUrl('https://github.com/user/repo.git');
      expect(result).toEqual({ owner: 'user', repo: 'repo' });
    });

    it('should return null for invalid URLs', () => {
      expect(parseGitHubUrl('https://gitlab.com/user/repo')).toBeNull();
      expect(parseGitHubUrl('not-a-url')).toBeNull();
    });
  });

  describe('isDeadlineApproaching', () => {
    it('should return true for deadlines within 24 hours', () => {
      const deadline = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours
      expect(isDeadlineApproaching(deadline)).toBe(true);
    });

    it('should return false for deadlines beyond 24 hours', () => {
      const deadline = new Date(Date.now() + 25 * 60 * 60 * 1000); // 25 hours
      expect(isDeadlineApproaching(deadline)).toBe(false);
    });

    it('should return false for past deadlines', () => {
      const deadline = new Date(Date.now() - 1000); // 1 second ago
      expect(isDeadlineApproaching(deadline)).toBe(false);
    });
  });
});