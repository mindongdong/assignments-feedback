import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { ExternalServiceError } from '../utils/errors';
import { retryWithBackoff } from '../utils/helpers';
// import { CacheService } from './CacheService'; // Redis cache removed - not functional
import * as crypto from 'crypto';

export interface FeedbackRequest {
  assignment: {
    code: string;
    title: string;
    requirements: string[];
    recommendations: string[];
    category?: 'programming' | 'frontend' | 'backend' | 'blog' | 'algorithm' | 'design' | 'analysis';
    position?: 'frontend_react' | 'backend_fastapi' | string; // Specific technology position
    evaluationCriteria?: string[] | { title: string; points: number; details: string[] }[]; // Custom evaluation criteria
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
  };
  submission: {
    type: 'blog' | 'code';
    content: string;
    url?: string;
    title?: string;
    metadata?: any;
  };
  user_context?: {
    previous_submissions: number;
    average_score: number;
    learning_level?: 'beginner' | 'intermediate' | 'advanced';
    preferred_feedback_style?: 'detailed' | 'concise' | 'encouraging';
    cultural_context?: 'korean_academic' | 'international';
  };
  performance_hint?: {
    max_response_time_ms?: number;
    use_cached_patterns?: boolean;
  };
}

export interface AIFeedbackResponse {
  content: string; // Markdown formatted feedback in Korean
  score: number; // 0-100
  criteria_scores: {
    requirements_met: number;
    code_quality: number;
    best_practices: number;
    creativity: number;
  };
  feedback_quality: {
    confidence_score: number; // AI confidence in feedback accuracy
    cultural_appropriateness: number; // Korean academic context appropriateness
    actionability: number; // How actionable the suggestions are
  };
  improvement_suggestions: string[]; // Specific next steps
  learning_resources: string[]; // Korean language learning resources
  cache_info: {
    cache_key: string;
    cache_hit: boolean;
    response_time_ms: number;
  };
  generated_at: string;
  model_info: {
    provider: string;
    model: string;
    tokens_used?: number;
  };
  analyzed_files?: {
    file_tree: string;
    file_count: number;
    total_size: number;
  };
  // Legacy fields for backward compatibility
  next_steps?: string[];
  model_used?: string;
  cache_hit?: boolean;
  generation_time_ms?: number;
}

export interface ValidationResult {
  is_valid: boolean;
  missing_requirements: string[];
  suggestions: string[];
}

export interface ExtractedContent {
  content: string;
  title?: string;
  metadata?: any;
}

// Korean prompt templates for different assignment types
interface PromptTemplate {
  system: string;
  feedback: string;
  validation: string;
}

interface ClaudeStructuredResponse {
  feedback: string;
  overall_score: number;
  criteria_scores: {
    requirements_met: number;
    code_quality: number;
    best_practices: number;
    creativity: number;
  };
  feedback_quality: {
    confidence_score: number;
    cultural_appropriateness: number;
    actionability: number;
  };
  improvement_suggestions: string[];
  next_steps: string[];
}

export class AIService {
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private provider: 'anthropic' | 'openai';
  // private cacheService?: CacheService; // Cache system removed
  private modelConfig: {
    claudeModel: string;
    openaiModel: string;
    maxTokens: number;
    temperature: number;
    cacheTTL: number;
    performanceTarget: number;
  };
  private promptTemplates: Map<string, PromptTemplate> = new Map();
  private performanceMetrics: {
    avgResponseTime: number;
    cacheHitRate: number;
    totalRequests: number;
  };

  constructor() {
    // Provider preference from environment
    const preference = (process.env.AI_MODEL_PREFERENCE || 'claude').toLowerCase();
    this.provider = preference === 'openai' ? 'openai' : 'anthropic';
    // this.cacheService = cacheService; // Cache system removed
    
    // Enhanced model configuration from environment variables
    this.modelConfig = {
      claudeModel: process.env.AI_CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      openaiModel: process.env.AI_OPENAI_MODEL || 'gpt-4o',
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '8000'), // Increased default from 4000 to 8000
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.2'),
      cacheTTL: parseInt(process.env.AI_CACHE_TTL || '1800'), // 30 minutes
      performanceTarget: parseInt(process.env.AI_PERFORMANCE_TARGET_MS || '100'),
    };
    
    // Initialize performance metrics
    this.performanceMetrics = {
      avgResponseTime: 0,
      cacheHitRate: 0,
      totalRequests: 0,
    };
    
    // Initialize Korean prompt templates for different assignment categories
    this.initializePromptTemplates();
    
    // Initialize clients based on availability and preference
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      logger.info(`Claude client initialized with model: ${this.modelConfig.claudeModel}`);
    }
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      logger.info(`OpenAI client initialized with model: ${this.modelConfig.openaiModel}`);
    }
    
    // Check if preferred provider is available
    if (this.provider === 'anthropic' && !this.anthropic) {
      if (this.openai) {
        logger.warn('Claude preferred but not available. Falling back to OpenAI.');
        this.provider = 'openai';
      } else {
        logger.error('No AI service configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
      }
    } else if (this.provider === 'openai' && !this.openai) {
      if (this.anthropic) {
        logger.warn('OpenAI preferred but not available. Falling back to Claude.');
        this.provider = 'anthropic';
      } else {
        logger.error('No AI service configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
      }
    }
    
    logger.info(`Enhanced AI Service initialized with provider: ${this.provider}, performance target: ${this.modelConfig.performanceTarget}ms`);
  }

  /**
   * Generate comprehensive feedback for submission with intelligent caching
   */
  async generateFeedback(request: FeedbackRequest): Promise<AIFeedbackResponse> {
    const startTime = Date.now();
    
    try {
      // Generate cache key from request content
      const cacheKey = this.generateCacheKey(request);
      
      // Cache system removed - Redis not functional
      logger.info('Generating new AI feedback request', { cacheKey });
      
      // Generate new feedback
      let response: AIFeedbackResponse;
      
      if (this.provider === 'anthropic' && this.anthropic) {
        response = await this.generateWithClaudeStructured(request);
      } else if (this.provider === 'openai' && this.openai) {
        response = await this.generateWithOpenAIStructured(request);
      } else {
        throw new ExternalServiceError('AI', 'AI 서비스가 설정되지 않았습니다.');
      }
      
      // Add metadata and legacy fields for backward compatibility
      response.cache_info.response_time_ms = Date.now() - startTime;
      response.model_used = response.model_info.model; // Legacy field
      response.cache_hit = response.cache_info.cache_hit; // Legacy field  
      response.generation_time_ms = response.cache_info.response_time_ms; // Legacy field
      response.next_steps = response.improvement_suggestions; // Legacy field
      
      // Cache system removed - Redis not functional
      logger.info('AI feedback generated successfully', { responseTime: Date.now() - startTime });
      
      this.updatePerformanceMetrics(Date.now() - startTime, false);
      
      return response;
    } catch (error) {
      logger.error('AI feedback generation failed:', error);
      
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new ExternalServiceError('AI', 'AI 피드백 생성 중 오류가 발생했습니다.');
    }
  }

  /**
   * Validate submission content against requirements
   */
  async validateSubmissionContent(
    content: string, 
    requirements: string[]
  ): Promise<ValidationResult> {
    try {
      const prompt = this.buildValidationPrompt(content, requirements);
      
      let response: string;
      
      if (this.provider === 'anthropic' && this.anthropic) {
        response = await this.generateWithAnthropic(prompt);
      } else if (this.provider === 'openai' && this.openai) {
        response = await this.generateWithOpenAI(prompt);
      } else {
        // Fallback: basic keyword validation
        return this.basicValidation(content, requirements);
      }

      return this.parseValidationResponse(response);
    } catch (error) {
      logger.error('Content validation failed:', error);
      // Return basic validation as fallback
      return this.basicValidation(content, requirements);
    }
  }

  /**
   * Generate feedback using Anthropic Claude with structured output
   */
  private async generateWithClaudeStructured(request: FeedbackRequest): Promise<AIFeedbackResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const template = this.getPromptTemplate(request.assignment.category || 'programming', request.assignment.position);
    const prompt = this.buildEnhancedFeedbackPrompt(request, template);

    return retryWithBackoff(async () => {
      const response = await this.anthropic!.messages.create({
        model: this.modelConfig.claudeModel,
        max_tokens: this.modelConfig.maxTokens,
        temperature: this.modelConfig.temperature,
        system: template.system,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      return this.parseClaudeStructuredResponse(content.text, request);
    }, 3, 1000);
  }

  /**
   * Generate feedback using Anthropic Claude (legacy method for backward compatibility)
   */
  private async generateWithAnthropic(prompt: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    return retryWithBackoff(async () => {
      const response = await this.anthropic!.messages.create({
        model: this.modelConfig.claudeModel,
        max_tokens: this.modelConfig.maxTokens,
        temperature: this.modelConfig.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      return content.text;
    }, 3, 1000);
  }

  /**
   * Generate feedback using OpenAI GPT with structured output
   */
  private async generateWithOpenAIStructured(request: FeedbackRequest): Promise<AIFeedbackResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const template = this.getPromptTemplate(request.assignment.category || 'programming', request.assignment.position);
    const prompt = this.buildEnhancedFeedbackPrompt(request, template);

    return retryWithBackoff(async () => {
      const response = await this.openai!.chat.completions.create({
        model: this.modelConfig.openaiModel,
        messages: [
          {
            role: 'system',
            content: template.system,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: this.modelConfig.maxTokens,
        temperature: this.modelConfig.temperature,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      return this.parseOpenAIStructuredResponse(content, request);
    }, 3, 1000);
  }

  /**
   * Generate feedback using OpenAI GPT (legacy method for backward compatibility)
   */
  private async generateWithOpenAI(prompt: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    return retryWithBackoff(async () => {
      const response = await this.openai!.chat.completions.create({
        model: this.modelConfig.openaiModel,
        messages: [
          {
            role: 'system',
            content: '당신은 프로그래밍 과제를 평가하는 전문 멘토입니다. 한국어로 건설적이고 구체적인 피드백을 제공해주세요.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: this.modelConfig.maxTokens,
        temperature: this.modelConfig.temperature,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      return content;
    }, 3, 1000);
  }

  /**
   * Build prompt for feedback generation
   */
  private buildFeedbackPrompt(request: FeedbackRequest): string {
    const { assignment, submission, user_context } = request;
    
    return `
과제 평가를 위한 피드백을 생성해주세요.

## 과제 정보
- 과제명: ${assignment.title}
- 과제 코드: ${assignment.code}
- 요구사항: ${assignment.requirements.join(', ')}
- 권장사항: ${assignment.recommendations.join(', ')}

## 제출물 정보
- 유형: ${submission.type === 'blog' ? '블로그 글' : '코드'}
- 내용:
\`\`\`
${submission.content}
\`\`\`

${user_context ? `
## 학습자 정보
- 이전 제출 횟수: ${user_context.previous_submissions}
- 평균 점수: ${user_context.average_score}점
` : ''}

## 평가 기준
1. 요구사항 충족도 (0-100점)
2. 코드/내용 품질 (0-100점)
3. 모범 사례 적용 (0-100점)
4. 창의성 및 개선점 (0-100점)

다음 JSON 형식으로 응답해주세요:
{
  "feedback": "마크다운 형식의 상세한 피드백",
  "overall_score": 총점(0-100),
  "criteria_scores": {
    "requirements_met": 점수,
    "code_quality": 점수,
    "best_practices": 점수,
    "creativity": 점수
  }
}

피드백은 다음을 포함해야 합니다:
- 잘한 점 (구체적인 예시 포함)
- 개선할 점 (구체적인 방법 제시)
- 추가 학습 권장사항
- 격려의 메시지

한국어로 친근하고 건설적인 톤으로 작성해주세요.
`;
  }

  /**
   * Build prompt for content validation
   */
  private buildValidationPrompt(content: string, requirements: string[]): string {
    return `
다음 내용이 요구사항을 얼마나 충족하는지 평가해주세요.

## 요구사항
${requirements.map((req, index) => `${index + 1}. ${req}`).join('\n')}

## 제출 내용
\`\`\`
${content}
\`\`\`

다음 JSON 형식으로 응답해주세요:
{
  "is_valid": boolean,
  "missing_requirements": ["충족되지 않은 요구사항들"],
  "suggestions": ["구체적인 개선 제안들"]
}
`;
  }

  /**
   * Parse AI feedback response (legacy method for backward compatibility)
   */
  private parseFeedbackResponse(response: string): AIFeedbackResponse {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        content: parsed.feedback || response,
        score: parsed.overall_score || 70,
        criteria_scores: {
          requirements_met: parsed.criteria_scores?.requirements_met || 70,
          code_quality: parsed.criteria_scores?.code_quality || 70,
          best_practices: parsed.criteria_scores?.best_practices || 70,
          creativity: parsed.criteria_scores?.creativity || 70,
        },
        feedback_quality: {
          confidence_score: 70,
          cultural_appropriateness: 80,
          actionability: 70,
        },
        improvement_suggestions: ['추가 학습을 권장합니다.'],
        learning_resources: [
          '모던 JavaScript 튜토리얼: https://ko.javascript.info/',
          '생활코딩 웹 개발 강의: https://opentutorials.org/'
        ],
        cache_info: {
          cache_key: 'legacy_response',
          cache_hit: false,
          response_time_ms: 0,
        },
        generated_at: new Date().toISOString(),
        model_info: {
          provider: this.provider,
          model: this.provider === 'anthropic' ? this.modelConfig.claudeModel : this.modelConfig.openaiModel,
          tokens_used: response.length,
        },
        // Legacy fields
        next_steps: ['추가 학습을 권장합니다.'],
        model_used: this.provider === 'anthropic' ? this.modelConfig.claudeModel : this.modelConfig.openaiModel,
        cache_hit: false,
        generation_time_ms: 0,
      };
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      
      // Fallback: return response as-is with default scores
      return {
        content: response,
        score: 70,
        criteria_scores: {
          requirements_met: 70,
          code_quality: 70,
          best_practices: 70,
          creativity: 70,
        },
        feedback_quality: {
          confidence_score: 50,
          cultural_appropriateness: 80,
          actionability: 60,
        },
        improvement_suggestions: ['피드백 파싱에 실패했습니다. 다시 시도해주세요.'],
        learning_resources: [
          '모던 JavaScript 튜토리얼: https://ko.javascript.info/',
          '생활코딩 웹 개발 강의: https://opentutorials.org/'
        ],
        cache_info: {
          cache_key: 'legacy_fallback',
          cache_hit: false,
          response_time_ms: 0,
        },
        generated_at: new Date().toISOString(),
        model_info: {
          provider: this.provider,
          model: this.provider === 'anthropic' ? this.modelConfig.claudeModel : this.modelConfig.openaiModel,
          tokens_used: response.length,
        },
        // Legacy fields
        next_steps: ['피드백 파싱에 실패했습니다. 다시 시도해주세요.'],
        model_used: this.provider === 'anthropic' ? this.modelConfig.claudeModel : this.modelConfig.openaiModel,
        cache_hit: false,
        generation_time_ms: 0,
      };
    }
  }

  /**
   * Parse validation response
   */
  private parseValidationResponse(response: string): ValidationResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        is_valid: parsed.is_valid || false,
        missing_requirements: parsed.missing_requirements || [],
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      logger.error('Failed to parse validation response:', error);
      return {
        is_valid: true, // Default to valid to avoid blocking submissions
        missing_requirements: [],
        suggestions: [],
      };
    }
  }

  /**
   * Basic validation fallback (keyword matching)
   */
  private basicValidation(content: string, requirements: string[]): ValidationResult {
    const lowerContent = content.toLowerCase();
    const missingRequirements: string[] = [];
    
    for (const requirement of requirements) {
      const keywords = requirement.toLowerCase().split(/[\s,]+/);
      const hasKeyword = keywords.some(keyword => 
        keyword.length > 2 && lowerContent.includes(keyword)
      );
      
      if (!hasKeyword) {
        missingRequirements.push(requirement);
      }
    }
    
    return {
      is_valid: missingRequirements.length === 0,
      missing_requirements: missingRequirements,
      suggestions: missingRequirements.map(req => `${req}에 대한 내용을 추가해주세요.`),
    };
  }

  /**
   * Check if AI service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (this.provider === 'anthropic' && this.anthropic) {
        // Simple test request
        await this.anthropic.messages.create({
          model: this.modelConfig.claudeModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }],
        });
        return true;
      } else if (this.provider === 'openai' && this.openai) {
        // Simple test request
        await this.openai.chat.completions.create({
          model: this.modelConfig.openaiModel,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10,
        });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('AI service availability check failed:', error);
      return false;
    }
  }

  /**
   * Get current AI model configuration
   */
  getModelInfo(): {
    provider: string;
    model: string;
    maxTokens: number;
    temperature: number;
  } {
    return {
      provider: this.provider,
      model: this.provider === 'anthropic' ? this.modelConfig.claudeModel : this.modelConfig.openaiModel,
      maxTokens: this.modelConfig.maxTokens,
      temperature: this.modelConfig.temperature,
    };
  }

  /**
   * Switch provider dynamically (for testing or failover)
   */
  async switchProvider(newProvider: 'anthropic' | 'openai'): Promise<boolean> {
    if (newProvider === 'anthropic' && this.anthropic) {
      this.provider = 'anthropic';
      logger.info('Switched to Anthropic Claude');
      return true;
    } else if (newProvider === 'openai' && this.openai) {
      this.provider = 'openai';
      logger.info('Switched to OpenAI GPT');
      return true;
    } else {
      logger.error(`Cannot switch to ${newProvider}: service not initialized`);
      return false;
    }
  }

  /**
   * Initialize Korean prompt templates for different assignment categories
   */
  private initializePromptTemplates(): void {
    this.promptTemplates = new Map();

    // Frontend (React.js) assignments template
    this.promptTemplates.set('frontend', {
      system: `당신은 한국의 React.js 프론트엔드 개발 교육 전문가입니다.
      학습자에게 React.js와 모던 프론트엔드 개발에 대한 구체적이고 실용적인 코드 리뷰를 제공합니다.
      
      전문 분야:
      - React.js 컴포넌트 설계 및 구조
      - React Hooks (useState, useEffect, useRef, useCallback, useMemo 등)
      - 상태 관리 패턴 및 최적화
      - JSX 문법과 컴포넌트 스타일링
      - 프론트엔드 성능 최적화
      - 사용자 경험(UX) 개선
      
      피드백 작성 원칙:
      1. 평가 기준별로 구체적인 코드 부분을 인용하여 평가
      2. 각 평가 항목마다 "[평가한 코드 특정 부분]이 [평가 이유]로 해당 항목에 [부합했다/부합하지 않았다] 그래서 [점수]점이다" 형식 사용
      3. React.js 베스트 프랙티스 기준으로 평가
      4. 실제 코드 라인 번호나 컴포넌트명을 명시
      5. 개선 코드 예시 제공`,
      feedback: '',
      validation: ''
    });

    // Backend (FastAPI) assignments template
    this.promptTemplates.set('backend', {
      system: `당신은 한국의 FastAPI 백엔드 개발 교육 전문가입니다.
      학습자에게 FastAPI와 Python 백엔드 개발에 대한 구체적이고 실용적인 코드 리뷰를 제공합니다.
      
      전문 분야:
      - FastAPI 라우팅 및 엔드포인트 설계
      - Pydantic 모델과 데이터 검증
      - 비동기 프로그래밍 (async/await)
      - 데이터베이스 연동 (SQLAlchemy, MongoDB)
      - API 보안 및 인증/인가
      - RESTful API 설계 원칙
      - 에러 핸들링과 로깅
      
      피드백 작성 원칙:
      1. 평가 기준별로 구체적인 코드 부분을 인용하여 평가
      2. 각 평가 항목마다 "[평가한 코드 특정 부분]이 [평가 이유]로 해당 항목에 [부합했다/부합하지 않았다] 그래서 [점수]점이다" 형식 사용
      3. FastAPI와 Python 베스트 프랙티스 기준으로 평가
      4. 실제 코드 라인 번호나 함수명을 명시
      5. 개선 코드 예시 제공`,
      feedback: '',
      validation: ''
    });

    // Generic programming assignments template (fallback)
    this.promptTemplates.set('programming', {
      system: `당신은 한국의 프로그래밍 교육 전문가입니다. 
      학습자에게 건설적이고 구체적인 코드 리뷰를 제공하며, 
      한국 개발 문화와 학습 환경에 맞는 피드백을 작성합니다.
      
      피드백 원칙:
      - 긍정적이고 격려적인 톤 사용
      - 구체적인 코드 예시와 개선방안 제시
      - 한국어 개발 용어와 관례 사용
      - 학습 단계별 맞춤형 조언
      - 실무에서 활용 가능한 실용적인 제안`,
      feedback: '',
      validation: ''
    });

    // Blog writing assignments template
    this.promptTemplates.set('blog', {
      system: `당신은 한국의 기술 블로그 작성 전문가입니다.
      개발자들의 기술 블로그 글쓰기를 지도하며,
      한국 IT 커뮤니티에서 선호되는 글쓰기 스타일을 반영합니다.
      
      피드백 원칙:
      - 독자 친화적인 설명 방식 권장
      - 한국어 기술 문서 작성 관례 준수
      - SEO와 가독성을 고려한 구조화
      - 코드와 설명의 균형 잡힌 배치
      - 개발자 커뮤니티에서의 공유 가치`,
      feedback: '',
      validation: ''
    });

    // Algorithm assignments template
    this.promptTemplates.set('algorithm', {
      system: `당신은 알고리즘과 자료구조 교육 전문가입니다.
      효율적인 알고리즘 설계와 구현에 대한 피드백을 제공하며,
      한국의 코딩테스트 문화와 학습 방식을 고려합니다.
      
      피드백 원칙:
      - 시간복잡도와 공간복잡도 분석
      - 다양한 해결방법 제시와 비교
      - 코딩테스트 실전 팁 포함
      - 단계별 사고과정 설명
      - 최적화 방향 제시`,
      feedback: '',
      validation: ''
    });
  }

  /**
   * Get prompt template based on assignment category and position
   */
  private getPromptTemplate(category: string, position?: string): PromptTemplate {
    // Check position first for more specific templates
    if (position) {
      if (position === 'frontend_react' || position.includes('react')) {
        return this.promptTemplates.get('frontend')!;
      }
      if (position === 'backend_fastapi' || position.includes('fastapi')) {
        return this.promptTemplates.get('backend')!;
      }
    }
    
    // Check category for template selection
    if (category === 'frontend') {
      return this.promptTemplates.get('frontend')!;
    }
    if (category === 'backend') {
      return this.promptTemplates.get('backend')!;
    }
    
    // Default to generic programming template
    return this.promptTemplates.get(category) || this.promptTemplates.get('programming')!;
  }

  /**
   * Build enhanced feedback prompt with cultural context
   */
  private buildEnhancedFeedbackPrompt(request: FeedbackRequest, template: PromptTemplate): string {
    const { assignment, submission, user_context } = request;
    
    // Determine Korean cultural context
    const culturalContext = user_context?.cultural_context || 'korean_academic';
    const learningLevel = user_context?.learning_level || 'intermediate';
    const feedbackStyle = user_context?.preferred_feedback_style || 'detailed';

    return `
## 과제 평가 요청

### 과제 정보
- **과제명**: ${assignment.title}
- **과제 코드**: ${assignment.code}
- **분야**: ${this.translateCategory(assignment.category || 'programming')}
${assignment.position ? `- **기술 스택**: ${this.translatePosition(assignment.position)}` : ''}
- **난이도**: ${assignment.difficulty || 'intermediate'}

### 요구사항 (피드백 시 참고용)
${assignment.requirements.map((req, idx) => `${idx + 1}. ${req}`).join('\n')}

### 평가 기준 (이 형식대로 피드백 작성 필수)
${this.generateEvaluationCriteria(assignment)}

### 권장사항
${assignment.recommendations.map((rec, idx) => `${idx + 1}. ${rec}`).join('\n')}

### 제출물 정보
- **유형**: ${submission.type === 'blog' ? '기술 블로그 글' : '프로그래밍 코드'}
- **제목**: ${submission.title || '제목 없음'}
${submission.url ? `- **URL**: ${submission.url}` : ''}

### 제출 내용
\`\`\`${submission.type === 'code' ? this.detectLanguage(submission.content) : 'markdown'}
${submission.content}
\`\`\`

${user_context ? `
### 학습자 정보
- **이전 제출 횟수**: ${user_context.previous_submissions}회
- **평균 점수**: ${user_context.average_score}점
- **학습 수준**: ${this.translateLearningLevel(learningLevel)}
- **선호 피드백 스타일**: ${this.translateFeedbackStyle(feedbackStyle)}
` : ''}

### 피드백 요청사항
**한국어 마크다운 형식**으로 다음 구조로 상세하고 건설적인 피드백을 작성해주세요:

**예시 형식:**
\`\`\`markdown
# 피드백 제목

## 평가 기준별 상세 피드백

### 1. 평가 항목명 (XX점)
[... 구체적인 평가 내용 ...]

## 최종 평가
평가 기준별 상세 피드백 내용을 종합하여 다음 항목들을 포함한 상세한 종합 평가를 작성해주세요:
- 전체적인 구현 수준과 완성도 평가
- 각 평가 기준에서 나타난 강점과 약점 요약
- 코드 품질과 구조적 우수성에 대한 종합적 판단
- 개발자의 기술적 역량 수준 평가
- 향후 학습 방향에 대한 구체적 조언
- 실무 적용 가능성과 개선 우선순위
\`\`\`

### 피드백 작성 가이드라인
1. **마크다운 형식 사용**: JSON이 아닌 마크다운 형식으로 깔끔하게 작성
2. **평가 기준별 구체적 평가**: 각 평가 기준에 대해 "[코드의 특정 부분]이 [구체적인 이유]로 해당 항목에 [부합했다/부합하지 않았다] 그래서 [점수]점이다" 형식 사용
3. **코드 인용**: 실제 제출된 코드의 특정 부분(함수명, 컴포넌트명, 라인 등)을 구체적으로 언급
4. **개선 방안 제시**: 부족한 부분에 대한 구체적인 개선 코드 예시 제공
5. **최종 평가 작성**: 마지막에 '## 최종 평가' 섹션을 추가하여 평가 기준별 피드백을 종합한 상세한 종합 평가를 작성
6. **추천 학습 자료 금지**: 학습 자료 추천이나 참고 링크는 절대 포함하지 말 것

한국의 개발 학습 문화와 ${culturalContext === 'korean_academic' ? '학술적 환경' : '국제적 환경'}에 맞는 톤과 내용으로 작성해주세요.
`;
  }

  /**
   * Parse Claude structured response
   */
  private parseClaudeStructuredResponse(response: string, request: FeedbackRequest): AIFeedbackResponse {
    try {
      // Since we're now requesting markdown format, use the response directly as content
      // Try to extract scores if they're mentioned in the response, otherwise use defaults
      const scoreMatch = response.match(/총점[:\s]*([0-9]+)(?:[\/점])/i) || 
                        response.match(/전체[:\s]*([0-9]+)(?:[\/점])/i);
      const overallScore = scoreMatch ? parseInt(scoreMatch[1]) : 75;
      
      // Extract individual criteria scores if mentioned
      const requirementsMatch = response.match(/요구사항[^0-9]*([0-9]+)(?:[\/점])/i);
      const qualityMatch = response.match(/품질[^0-9]*([0-9]+)(?:[\/점])/i);
      const practicesMatch = response.match(/모범[^0-9]*([0-9]+)(?:[\/점])/i);
      const creativityMatch = response.match(/창의[^0-9]*([0-9]+)(?:[\/점])/i);
      
      return {
        content: response, // Use the entire markdown response as content
        score: overallScore,
        criteria_scores: {
          requirements_met: requirementsMatch ? parseInt(requirementsMatch[1]) : Math.round(overallScore * 0.9),
          code_quality: qualityMatch ? parseInt(qualityMatch[1]) : Math.round(overallScore * 0.85),
          best_practices: practicesMatch ? parseInt(practicesMatch[1]) : Math.round(overallScore * 0.8),
          creativity: creativityMatch ? parseInt(creativityMatch[1]) : Math.round(overallScore * 0.7),
        },
        feedback_quality: {
          confidence_score: 85,
          cultural_appropriateness: 90,
          actionability: 80,
        },
        improvement_suggestions: this.extractImprovementSuggestions(response),
        learning_resources: [], // Remove learning resources as requested
        cache_info: {
          cache_key: this.generateCacheKey(request),
          cache_hit: false,
          response_time_ms: 0,
        },
        generated_at: new Date().toISOString(),
        model_info: {
          provider: 'anthropic',
          model: this.modelConfig.claudeModel,
          tokens_used: response.length,
        },
        analyzed_files: this.extractAnalyzedFiles(request),
      };
    } catch (error) {
      logger.error('Failed to parse Claude structured response:', error);
      return this.createFallbackResponse(response, request);
    }
  }

  /**
   * Parse OpenAI structured response
   */
  private parseOpenAIStructuredResponse(response: string, request: FeedbackRequest): AIFeedbackResponse {
    try {
      // First try to parse as JSON (OpenAI might still return JSON format)
      let parsedContent: any = null;
      let isJsonResponse = false;
      
      try {
        parsedContent = JSON.parse(response);
        isJsonResponse = true;
      } catch {
        // If not JSON, treat as markdown like Claude
      }
      
      if (isJsonResponse && parsedContent) {
        return {
          content: parsedContent.feedback || response,
          score: parsedContent.overall_score || 75,
          criteria_scores: {
            requirements_met: parsedContent.criteria_scores?.requirements_met || 75,
            code_quality: parsedContent.criteria_scores?.code_quality || 75,
            best_practices: parsedContent.criteria_scores?.best_practices || 75,
            creativity: parsedContent.criteria_scores?.creativity || 75,
          },
          feedback_quality: {
            confidence_score: parsedContent.feedback_quality?.confidence_score || 85,
            cultural_appropriateness: parsedContent.feedback_quality?.cultural_appropriateness || 90,
            actionability: parsedContent.feedback_quality?.actionability || 80,
          },
          improvement_suggestions: parsedContent.improvement_suggestions || this.extractImprovementSuggestions(response),
          learning_resources: [], // Remove learning resources as requested
          cache_info: {
            cache_key: this.generateCacheKey(request),
            cache_hit: false,
            response_time_ms: 0,
          },
          generated_at: new Date().toISOString(),
          model_info: {
            provider: 'openai',
            model: this.modelConfig.openaiModel,
            tokens_used: response.length,
          },
          analyzed_files: this.extractAnalyzedFiles(request),
        };
      } else {
        // Handle as markdown response
        const scoreMatch = response.match(/총점[:\s]*([0-9]+)(?:[\/점])/i) || 
                          response.match(/전체[:\s]*([0-9]+)(?:[\/점])/i);
        const overallScore = scoreMatch ? parseInt(scoreMatch[1]) : 75;
        
        return {
          content: response,
          score: overallScore,
          criteria_scores: {
            requirements_met: Math.round(overallScore * 0.9),
            code_quality: Math.round(overallScore * 0.85),
            best_practices: Math.round(overallScore * 0.8),
            creativity: Math.round(overallScore * 0.7),
          },
          feedback_quality: {
            confidence_score: 85,
            cultural_appropriateness: 90,
            actionability: 80,
          },
          improvement_suggestions: this.extractImprovementSuggestions(response),
          learning_resources: [], // Remove learning resources as requested
          cache_info: {
            cache_key: this.generateCacheKey(request),
            cache_hit: false,
            response_time_ms: 0,
          },
          generated_at: new Date().toISOString(),
          model_info: {
            provider: 'openai',
            model: this.modelConfig.openaiModel,
            tokens_used: response.length,
          },
          analyzed_files: this.extractAnalyzedFiles(request),
        };
      }
    } catch (error) {
      logger.error('Failed to parse OpenAI structured response:', error);
      return this.createFallbackResponse(response, request);
    }
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: FeedbackRequest): string {
    const keyData = {
      assignment_code: request.assignment.code,
      content_hash: crypto.createHash('md5').update(request.submission.content).digest('hex'),
      category: request.assignment.category,
      type: request.submission.type,
    };
    
    return `ai_feedback_${crypto.createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16)}`;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(responseTime: number, cacheHit: boolean): void {
    this.performanceMetrics.totalRequests++;
    
    if (cacheHit) {
      this.performanceMetrics.cacheHitRate = 
        (this.performanceMetrics.cacheHitRate * (this.performanceMetrics.totalRequests - 1) + 1) 
        / this.performanceMetrics.totalRequests;
    } else {
      this.performanceMetrics.cacheHitRate = 
        (this.performanceMetrics.cacheHitRate * (this.performanceMetrics.totalRequests - 1)) 
        / this.performanceMetrics.totalRequests;
    }
    
    this.performanceMetrics.avgResponseTime = 
      (this.performanceMetrics.avgResponseTime * (this.performanceMetrics.totalRequests - 1) + responseTime) 
      / this.performanceMetrics.totalRequests;
  }

  /**
   * Helper methods for Korean localization
   */
  private translateLearningLevel(level: string): string {
    const translations = {
      'beginner': '초급자',
      'intermediate': '중급자',
      'advanced': '고급자'
    };
    return translations[level as keyof typeof translations] || '중급자';
  }

  private translateFeedbackStyle(style: string): string {
    const translations = {
      'detailed': '상세한 설명',
      'concise': '간결한 요약',
      'encouraging': '격려 중심'
    };
    return translations[style as keyof typeof translations] || '상세한 설명';
  }

  private detectLanguage(content: string): string {
    if (content.includes('function') || content.includes('const') || content.includes('let')) return 'javascript';
    if (content.includes('def ') || content.includes('import ')) return 'python';
    if (content.includes('public class') || content.includes('System.out')) return 'java';
    if (content.includes('#include') || content.includes('cout')) return 'cpp';
    return 'text';
  }

  private generateLearningResources(category?: string): string[] {
    const resources = {
      'programming': [
        '모던 JavaScript 튜토리얼: https://ko.javascript.info/',
        '생활코딩 웹 개발 강의: https://opentutorials.org/',
        '코딩도장 파이썬 기초: https://dojang.io/'
      ],
      'blog': [
        '개발자를 위한 글쓰기 가이드',
        'Markdown 작성법 완벽 가이드',
        '기술 블로그 SEO 최적화 방법'
      ],
      'algorithm': [
        '백준 온라인 저지: https://www.acmicpc.net/',
        '프로그래머스 코딩테스트: https://programmers.co.kr/',
        '알고리즘 문제해결전략 (종만북)'
      ]
    };
    
    return resources[category as keyof typeof resources] || resources.programming;
  }

  private createFallbackResponse(response: string, request: FeedbackRequest): AIFeedbackResponse {
    return {
      content: response,
      score: 70,
      criteria_scores: {
        requirements_met: 70,
        code_quality: 70,
        best_practices: 70,
        creativity: 70,
      },
      feedback_quality: {
        confidence_score: 50, // Lower confidence for fallback
        cultural_appropriateness: 80,
        actionability: 60,
      },
      improvement_suggestions: ['피드백 파싱에 실패했습니다. 다시 시도해주세요.'],
      learning_resources: [], // Remove learning resources as requested
      cache_info: {
        cache_key: this.generateCacheKey(request),
        cache_hit: false,
        response_time_ms: 0,
      },
      generated_at: new Date().toISOString(),
      model_info: {
        provider: this.provider,
        model: this.provider === 'anthropic' ? this.modelConfig.claudeModel : this.modelConfig.openaiModel,
        tokens_used: response.length,
      },
      analyzed_files: this.extractAnalyzedFiles(request),
    };
  }

  /**
   * Extract improvement suggestions from markdown response
   */
  private extractImprovementSuggestions(response: string): string[] {
    const suggestions: string[] = [];
    
    // Look for improvement sections in markdown
    const improvementSections = [
      /## 개선.*?(?=##|$)/gis,
      /### 개선.*?(?=###|##|$)/gis,
      /개선.*?점.*?[:：]([^\n]+)/gi
    ];
    
    for (const regex of improvementSections) {
      const matches = response.match(regex);
      if (matches) {
        for (const match of matches) {
          // Extract bullet points or numbered lists from improvement sections
          const points = match.match(/[-*]\s+(.+?)(?=\n|$)/g) || 
                        match.match(/\d+\.\s+(.+?)(?=\n|$)/g);
          if (points) {
            points.forEach(point => {
              const cleaned = point.replace(/^[-*]\s+|^\d+\.\s+/, '').trim();
              if (cleaned && !suggestions.includes(cleaned)) {
                suggestions.push(cleaned);
              }
            });
          }
        }
      }
    }
    
    // Fallback: look for any mentions of improvements
    if (suggestions.length === 0) {
      const improvementMentions = response.match(/(?:개선|향상|보완).*?[.。]/g);
      if (improvementMentions) {
        suggestions.push(...improvementMentions.slice(0, 3)); // Take first 3
      }
    }
    
    return suggestions.length > 0 ? suggestions : ['지속적인 학습과 실습을 통한 개발 역량 향상을 권장합니다.'];
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      cache_config: {
        ttl_seconds: this.modelConfig.cacheTTL,
        performance_target_ms: this.modelConfig.performanceTarget,
      },
      model_config: this.getModelInfo(),
    };
  }

  /**
   * Translate category to Korean
   */
  private translateCategory(category: string): string {
    const translations: { [key: string]: string } = {
      'frontend': '프론트엔드',
      'backend': '백엔드',
      'programming': '프로그래밍',
      'algorithm': '알고리즘',
      'blog': '기술 블로그',
      'design': '설계',
      'analysis': '분석',
    };
    return translations[category] || category;
  }

  /**
   * Translate position to Korean
   */
  private translatePosition(position: string): string {
    const translations: { [key: string]: string } = {
      'frontend_react': 'React.js',
      'backend_fastapi': 'FastAPI',
      'frontend_vue': 'Vue.js',
      'frontend_angular': 'Angular',
      'backend_express': 'Express.js',
      'backend_django': 'Django',
      'backend_spring': 'Spring Boot',
      'fullstack': '풀스택',
    };
    return translations[position] || position;
  }

  /**
   * Generate evaluation criteria based on assignment type
   */
  private generateEvaluationCriteria(assignment: any): string {
    // If custom evaluation criteria are provided, format them appropriately
    if (assignment.evaluationCriteria) {
      // Check if it's an array of structured criteria objects
      if (Array.isArray(assignment.evaluationCriteria) && assignment.evaluationCriteria.length > 0) {
        // Check if first element is an object with title and points
        if (typeof assignment.evaluationCriteria[0] === 'object' && 'title' in assignment.evaluationCriteria[0]) {
          return assignment.evaluationCriteria.map((criterion: any, idx: number) => {
            const header = `${idx + 1}. **${criterion.title}** (${criterion.points}점)`;
            const details = criterion.details ? '\n' + criterion.details.map((d: string) => `   - ${d}`).join('\n') : '';
            return header + details;
          }).join('\n\n');
        }
        // If it's a simple string array
        else if (typeof assignment.evaluationCriteria[0] === 'string') {
          return assignment.evaluationCriteria.map((criterion: string, idx: number) => 
            `${idx + 1}. ${criterion}`
          ).join('\n');
        }
      }
    }

    const category = assignment.category || 'programming';
    const position = assignment.position;
    
    // Default evaluation criteria
    let criteria = [
      '1. **요구사항 충족도 (40점)**: 과제에서 요구한 기능들이 모두 구현되었는가?',
      '2. **코드 품질 (30점)**: 코드가 깔끔하고 읽기 쉬우며 유지보수가 용이한가?',
      '3. **모범 사례 적용 (20점)**: 해당 기술의 베스트 프랙티스를 따르고 있는가?',
      '4. **창의성 및 추가 구현 (10점)**: 요구사항 이상의 창의적인 기능이나 개선이 있는가?'
    ];

    // Customize criteria based on position first, then category
    if (position === 'frontend_react' || category === 'frontend') {
      criteria = [
        '1. **컴포넌트 구조 및 설계 (30점)**: React 컴포넌트가 적절히 분리되고 재사용 가능하게 설계되었는가?',
        '2. **React Hooks 활용 (25점)**: useState, useEffect 등 React Hooks를 올바르고 효율적으로 사용했는가?',
        '3. **상태 관리 (20점)**: 컴포넌트 간 상태 전달과 관리가 효율적으로 구현되었는가?',
        '4. **UI/UX 및 스타일링 (15점)**: 사용자 인터페이스가 직관적이고 반응형으로 구현되었는가?',
        '5. **코드 품질 및 최적화 (10점)**: 코드가 깔끔하고 성능 최적화가 고려되었는가?'
      ];
    } else if (position === 'backend_fastapi' || category === 'backend') {
      criteria = [
        '1. **API 설계 및 라우팅 (30점)**: RESTful API 원칙에 따라 엔드포인트가 잘 설계되었는가?',
        '2. **데이터 검증 및 모델링 (25점)**: Pydantic 모델을 활용한 데이터 검증이 적절한가?',
        '3. **비동기 처리 (20점)**: async/await를 올바르게 사용하여 비동기 작업을 처리했는가?',
        '4. **에러 처리 및 보안 (15점)**: 적절한 에러 처리와 기본적인 보안 조치가 구현되었는가?',
        '5. **코드 구조 및 문서화 (10점)**: 코드가 체계적으로 구성되고 API 문서가 자동 생성되는가?'
      ];
    }

    return criteria.join('\n');
  }

  /**
   * Extract analyzed files information for metadata
   */
  private extractAnalyzedFiles(request: FeedbackRequest) {
    const content = request.submission.content;
    const files: string[] = [];
    let totalSize = 0;
    
    // Extract file paths from markdown content
    const fileHeaders = content.match(/^## (.+\.(js|jsx|ts|tsx|py|java|cpp|c|go|rb|php|kt|swift|rs|scala).*?)$/gm);
    if (fileHeaders) {
      fileHeaders.forEach(header => {
        const filePath = header.replace(/^## /, '');
        files.push(filePath);
      });
    }
    
    // Also look for code blocks with file info
    const codeBlocks = content.match(/```[\w]*\n[\s\S]*?\n```/g);
    if (codeBlocks) {
      totalSize = codeBlocks.reduce((total, block) => total + block.length, 0);
    }
    
    // Generate file tree structure
    const fileTree = this.generateFileTree(files, content);
    
    return {
      file_tree: fileTree,
      file_count: files.length,
      total_size: totalSize
    };
  }

  /**
   * Generate a visual file tree from file paths
   */
  private generateFileTree(files: string[], content: string): string {
    if (files.length === 0) {
      // Extract from project structure if available
      const structureMatch = content.match(/```\n([\s\S]*?)\n```/);
      if (structureMatch && structureMatch[1].includes('├──') || structureMatch[1].includes('└──')) {
        return structureMatch[1];
      }
      return 'No specific file structure detected';
    }

    // Create a simple tree structure
    const tree = ['📁 분석된 파일 구조:'];
    const directories = new Set<string>();
    
    // Group files by directory
    files.forEach(file => {
      const parts = file.split('/');
      if (parts.length > 1) {
        for (let i = 0; i < parts.length - 1; i++) {
          directories.add(parts.slice(0, i + 1).join('/'));
        }
      }
    });
    
    // Sort directories and files
    const sortedDirs = Array.from(directories).sort();
    const sortedFiles = files.sort();
    
    // Build tree structure
    if (sortedDirs.length > 0) {
      sortedFiles.forEach((file, index) => {
        const isLast = index === sortedFiles.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        const fileName = file.split('/').pop() || file;
        tree.push(prefix + fileName);
      });
    } else {
      // Simple flat structure
      sortedFiles.forEach((file, index) => {
        const isLast = index === sortedFiles.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        tree.push(prefix + file);
      });
    }
    
    return tree.join('\n');
  }
}