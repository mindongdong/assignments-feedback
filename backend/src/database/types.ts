/**
 * Database type definitions for Discord assignment system
 * Extends Prisma generated types with custom interfaces
 */

import { 
  User, 
  Assignment, 
  Submission, 
  Feedback, 
  UserStats,
  AssignmentStats,
  SubmissionStats,
  SubmissionType,
  SubmissionStatus,
  Difficulty,
  FeedbackType,
  Prisma 
} from '@prisma/client';

// Extended user types
export interface UserWithStats extends User {
  userStats?: UserStats | null;
  stats?: {
    totalSubmissions: number;
    completedAssignments: number;
    averageScore: number | null;
    streakDays: number;
    lastSubmissionAt: Date | null;
    bestCategory: string | null;
  };
}

// Extended assignment types
export interface AssignmentWithStats extends Assignment {
  assignmentStats?: AssignmentStats | null;
  submissionCount?: number;
  averageScore?: number | null;
  completionRate?: number | null;
  _count?: {
    submissions: number;
  };
}

// Extended submission types
export interface SubmissionWithDetails extends Submission {
  user?: {
    discordId: string;
    username: string;
  };
  assignment?: {
    title: string;
    deadline: Date;
    category?: string | null;
  };
  feedback?: {
    aiFeedback: string;
    aiScore: any;
    feedbackType: string;
  } | null;
  submissionStats?: SubmissionStats | null;
}

// Extended feedback types
export interface FeedbackWithDetails extends Feedback {
  submission?: {
    id: string;
    title?: string | null;
    url?: string | null;
    submissionType: SubmissionType;
    user: {
      discordId: string;
      username: string;
    };
    assignment: {
      title: string;
      assignmentCode: string;
    };
  };
}

// Service input types
export interface CreateUserData {
  discordId: string;
  username: string;
  displayName?: string;
  locale?: string;
  timezone?: string;
}

export interface UpdateUserData {
  username?: string;
  displayName?: string;
  locale?: string;
  timezone?: string;
  lastSeenAt?: Date;
}

export interface CreateAssignmentData {
  title: string;
  description: string;
  requirements: string;
  recommendations: string;  
  deadline: Date;
  difficulty?: Difficulty;
  category?: string;
  estimatedHours?: number;
  maxSubmissions?: number;
  autoFeedback?: boolean;
  createdBy?: string;
}

export interface CreateSubmissionData {
  assignmentCode: string;
  discordId: string;
  submissionType: SubmissionType;
  url?: string;
  title?: string;
  content?: string;
  language?: string;
  metadata?: any;
}

export interface CreateFeedbackData {
  submissionId: string;
  aiFeedback: string;
  aiScore: any;
  aiModel?: string;
  aiTokensUsed?: number;
  processingTime?: number;
  language?: string;
  createdBy?: string;
}

export interface UpdateFeedbackData {
  manualFeedback?: string;
  feedbackType?: FeedbackType;
  isPublic?: boolean;
  createdBy?: string;
}

// Filter types
export interface AssignmentFilter {
  isActive?: boolean;
  category?: string;
  difficulty?: Difficulty;
  deadlineAfter?: Date;
  deadlineBefore?: Date;
  search?: string;
}

export interface SubmissionFilter {
  assignmentCode?: string;
  discordId?: string;
  status?: SubmissionStatus;
  submissionType?: SubmissionType;
  dateFrom?: Date;
  dateTo?: Date;
}

// Performance monitoring types
export interface PerformanceMetrics {
  operation: string;
  totalCalls: number;
  successfulCalls: number;
  avgExecutionTime: number;
  maxExecutionTime: number;
  minExecutionTime: number;
  successRate: number;
  errorTypes?: Record<string, number>;
}

export interface DiscordCommandMetrics {
  command: string;
  totalUses: number;
  avgResponseTime: number;
  successRate: number;
  userCount: number;
  popularityScore: number;
}

// Cache configuration
export interface CacheConfig {
  ttl?: number;
  compress?: boolean;
  prefix?: string;
}

// Assignment code validation
export interface AssignmentCodeValidation {
  isValid: boolean;
  sanitized?: string;
  error?: string;
  suggestions?: string[];
}

// Discord-specific types
export interface DiscordSubmissionStatus {
  status: 'not_submitted' | 'pending' | 'processing' | 'completed' | 'failed' | 'resubmitted';
  submission: SubmissionWithDetails | null;
  hasFeedback?: boolean;
}

export interface DiscordDeadlineStatus {
  status: 'closed' | 'urgent' | 'open';
  message: string;
  hoursLeft?: number;
  daysLeft?: number;
}

export interface DiscordHealthStatus {
  database: {
    database: boolean;
    redis: boolean;
    latency: {
      database: number;
      redis: number;
    };
  };
  alerts: any[];
  timestamp: Date;
}

// Prisma include types for consistent queries
export const UserInclude = {
  userStats: true,
  submissions: {
    include: {
      feedback: true,
      assignment: {
        select: { category: true },
      },
    },
    orderBy: { submittedAt: 'desc' as const },
  },
} satisfies Prisma.UserInclude;

export const AssignmentInclude = {
  assignmentStats: true,
  _count: {
    select: { submissions: true },
  },
} satisfies Prisma.AssignmentInclude;

export const SubmissionInclude = {
  user: {
    select: { discordId: true, username: true },
  },
  assignment: {
    select: { title: true, deadline: true, category: true },
  },
  feedback: {
    select: { aiFeedback: true, aiScore: true, feedbackType: true },
  },
} satisfies Prisma.SubmissionInclude;

export const FeedbackInclude = {
  submission: {
    include: {
      user: {
        select: { discordId: true, username: true },
      },
      assignment: {
        select: { title: true, assignmentCode: true },
      },
    },
  },
} satisfies Prisma.FeedbackInclude;

// Remove default export since these are all types/interfaces
// Use named exports only