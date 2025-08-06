import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { logger } from './logger';
import { BackendApiResponse, Assignment, Submission, Feedback, User } from '../types/Command';

class ApiClient {
  private client: AxiosInstance;
  private readonly baseURL: string;
  private readonly apiKey: string;

  constructor() {
    this.baseURL = process.env.BACKEND_API_URL || 'http://localhost:3000/api';
    this.apiKey = process.env.BACKEND_API_KEY || 'discord-bot-key';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Discord-Bot/1.0.0',
        'X-API-Key': this.apiKey,
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('API 요청 시작', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data,
        });
        return config;
      },
      (error) => {
        logger.error('API 요청 설정 오류:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug('API 요청 성공', {
          status: response.status,
          url: response.config.url,
          duration: response.headers['x-response-time'],
        });
        return response;
      },
      (error: AxiosError) => {
        logger.error('API 요청 실패', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  private handleApiError(error: AxiosError): Error {
    if (error.response) {
      // Server responded with an error status
      const status = error.response.status;
      const data = error.response.data as any;
      
      if (status === 401) {
        return new Error('인증이 필요합니다. 관리자에게 문의하세요.');
      } else if (status === 403) {
        return new Error('권한이 없습니다.');
      } else if (status === 404) {
        return new Error('요청한 데이터를 찾을 수 없습니다.');
      } else if (status === 429) {
        return new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      } else if (status >= 500) {
        return new Error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      } else {
        return new Error(data?.error?.message || '알 수 없는 오류가 발생했습니다.');
      }
    } else if (error.request) {
      // Network error
      return new Error('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.');
    } else {
      // Request setup error
      return new Error('요청 처리 중 오류가 발생했습니다.');
    }
  }

  // User operations
  async getOrCreateUser(discordId: string, username: string): Promise<User> {
    const response = await this.client.post<BackendApiResponse<User>>('/users/discord', {
      discord_id: discordId,
      username: username,
    });
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || '사용자 정보를 가져올 수 없습니다.');
    }
    
    return response.data.data;
  }

  async getUserProfile(discordId: string): Promise<User> {
    const response = await this.client.get<BackendApiResponse<User>>(`/users/discord/${discordId}`);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || '사용자 프로필을 찾을 수 없습니다.');
    }
    
    return response.data.data;
  }

  // Assignment operations
  async getAssignments(page: number = 1, limit: number = 10): Promise<{ assignments: Assignment[]; total: number }> {
    const response = await this.client.get<BackendApiResponse<{ assignments: Assignment[]; total: number }>>('/assignments', {
      params: { page, limit },
    });
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || '과제 목록을 가져올 수 없습니다.');
    }
    
    return response.data.data;
  }

  async getAssignment(assignmentCode: string): Promise<Assignment> {
    const response = await this.client.get<BackendApiResponse<Assignment>>(`/assignments/${assignmentCode}`);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || '과제를 찾을 수 없습니다.');
    }
    
    return response.data.data;
  }

  // Submission operations
  async createSubmission(assignmentCode: string, userId: string, githubLink?: string, content?: string): Promise<Submission> {
    const response = await this.client.post<BackendApiResponse<Submission>>('/submissions', {
      assignment_code: assignmentCode,
      user_id: userId,
      github_link: githubLink,
      submission_content: content,
    });
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || '과제 제출에 실패했습니다.');
    }
    
    return response.data.data;
  }

  async getUserSubmissions(userId: string, assignmentCode?: string): Promise<Submission[]> {
    const params: any = { user_id: userId };
    if (assignmentCode) {
      params.assignment_code = assignmentCode;
    }

    const response = await this.client.get<BackendApiResponse<Submission[]>>('/submissions', { params });
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || '제출 내역을 가져올 수 없습니다.');
    }
    
    return response.data.data;
  }

  async getSubmission(submissionId: string): Promise<Submission> {
    const response = await this.client.get<BackendApiResponse<Submission>>(`/submissions/${submissionId}`);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || '제출 정보를 찾을 수 없습니다.');
    }
    
    return response.data.data;
  }

  // Feedback operations
  async getFeedback(submissionId: string): Promise<Feedback[]> {
    const response = await this.client.get<BackendApiResponse<Feedback[]>>(`/submissions/${submissionId}/feedback`);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || '피드백을 가져올 수 없습니다.');
    }
    
    return response.data.data;
  }

  async requestFeedback(submissionId: string): Promise<Feedback> {
    const response = await this.client.post<BackendApiResponse<Feedback>>(`/submissions/${submissionId}/feedback`, {
      type: 'ai_generated',
    });
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || '피드백 생성에 실패했습니다.');
    }
    
    return response.data.data;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.error('서버 상태 확인 실패:', error);
      return false;
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;