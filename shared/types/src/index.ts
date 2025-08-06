// Assignment related types
export interface Assignment {
  id: string;
  assignmentCode: string; // 6-character unique code (e.g., ABC123)
  title: string;
  description: string;
  requirements: string;
  recommendations: string;
  deadline: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Submission related types
export enum SubmissionType {
  BLOG = 'blog',
  CODE = 'code',
}

export interface Submission {
  id: string;
  assignmentCode: string;
  userId: string;
  submissionType: SubmissionType;
  content: string;
  url?: string;
  submittedAt: Date;
}

// Feedback related types
export interface AIScore {
  requirementsFulfillment: number; // 1-10
  codeQuality: number; // 1-10
  bestPractices: number; // 1-10
  creativity: number; // 1-10
  overall: number; // 1-10
}

export interface Feedback {
  id: string;
  submissionId: string;
  aiFeedback: string;
  aiScore: AIScore;
  manualFeedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

// User related types
export interface User {
  id: string;
  discordId: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Discord command types
export interface CommandError {
  code: string;
  message: string;
}

// Assignment creation request
export interface CreateAssignmentRequest {
  title: string;
  description: string;
  requirements: string;
  recommendations: string;
  deadline: string; // ISO date string
}

// Submission creation request
export interface CreateSubmissionRequest {
  assignmentCode: string;
  userId: string;
  submissionType: SubmissionType;
  content?: string;
  url?: string;
  title?: string; // For blog submissions
}

// Feedback generation request
export interface GenerateFeedbackRequest {
  submissionId: string;
}

// Status types
export enum SubmissionStatus {
  NOT_SUBMITTED = 'not_submitted',
  SUBMITTED = 'submitted',
  LATE = 'late',
}

export interface UserSubmissionStatus {
  assignmentCode: string;
  assignmentTitle: string;
  deadline: Date;
  status: SubmissionStatus;
  submission?: Submission;
  feedback?: Feedback;
}