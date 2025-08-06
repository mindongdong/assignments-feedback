import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionResolvable } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  permissions?: PermissionResolvable[];
  adminOnly?: boolean;
}

export interface CommandExecutionContext {
  interaction: ChatInputCommandInteraction;
  userId: string;
  guildId: string;
  channelId: string;
  userName: string;
  timestamp: Date;
}

export interface BackendApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface Assignment {
  id: string;
  assignment_code: string;
  title: string;
  description: string;
  requirements: string[];
  recommendations?: string[];
  deadline: string;
  created_at: string;
  updated_at: string;
  category?: string;
  difficulty_level?: string;
  estimated_hours?: number;
}

export interface Submission {
  id: string;
  assignment_code: string;
  user_id: string;
  github_link?: string;
  submission_content?: string;
  status: 'submitted' | 'under_review' | 'feedback_ready' | 'completed';
  submitted_at: string;
  updated_at: string;
  metadata?: {
    file_count?: number;
    repo_size?: number;
    languages?: string[];
  };
}

export interface Feedback {
  id: string;
  submission_id: string;
  type: 'ai_generated' | 'manual';
  score: number;
  strengths: string[];
  improvements: string[];
  detailed_feedback: string;
  recommendations: string[];
  learning_resources?: string[];
  cultural_context?: {
    korean_practices?: string[];
    local_examples?: string[];
  };
  created_at: string;
  ai_model?: string;
  processing_time?: number;
}

export interface User {
  id: string;
  discord_id: string;
  username: string;
  email?: string;
  role: 'student' | 'admin';
  student_id?: string;
  created_at: string;
  preferences?: {
    language: string;
    notification_settings: {
      feedback_ready: boolean;
      deadline_reminders: boolean;
      assignment_updates: boolean;
    };
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}