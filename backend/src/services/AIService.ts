import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { ExternalServiceError } from '../utils/errors';
import { retryWithBackoff } from '../utils/helpers';
import { CacheService } from './CacheService';
import * as crypto from 'crypto';

export interface FeedbackRequest {
  assignment: {
    code: string;
    title: string;
    requirements: string[];
    recommendations: string[];
    category?: 'programming' | 'blog' | 'algorithm' | 'design' | 'analysis';
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
  private cacheService?: CacheService;
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

  constructor(cacheService?: CacheService) {
    // Provider preference from environment
    const preference = (process.env.AI_MODEL_PREFERENCE || 'claude').toLowerCase();
    this.provider = preference === 'openai' ? 'openai' : 'anthropic';
    this.cacheService = cacheService;
    
    // Enhanced model configuration from environment variables
    this.modelConfig = {
      claudeModel: process.env.AI_CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      openaiModel: process.env.AI_OPENAI_MODEL || 'gpt-4o',
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4000'),
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
      
      // Try cache first for performance optimization
      if (this.cacheService && request.performance_hint?.use_cached_patterns !== false) {
        const cached = await this.cacheService.get<AIFeedbackResponse>(
          cacheKey, 
          'ai_feedback'
        );
        
        if (cached) {
          this.updatePerformanceMetrics(Date.now() - startTime, true);
          logger.info('Cache hit for AI feedback request', { cacheKey });
          
          // Update cache info and legacy fields
          const responseTime = Date.now() - startTime;
          cached.cache_info.cache_hit = true;
          cached.cache_info.response_time_ms = responseTime;
          cached.cache_hit = true; // Legacy field
          cached.generation_time_ms = responseTime; // Legacy field
          
          return cached;
        }
      }
      
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
      
      // Cache the response
      if (this.cacheService) {
        await this.cacheService.set(
          cacheKey,
          response,
          this.modelConfig.cacheTTL,
          'ai_feedback'
        );
      }
      
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

    const template = this.getPromptTemplate(request.assignment.category || 'programming');
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

    const template = this.getPromptTemplate(request.assignment.category || 'programming');
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

    // Programming assignments template
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
   * Get prompt template based on assignment category
   */
  private getPromptTemplate(category: string): PromptTemplate {
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
- **분야**: ${assignment.category || 'programming'}
- **난이도**: ${assignment.difficulty || 'intermediate'}

### 요구사항
${assignment.requirements.map((req, idx) => `${idx + 1}. ${req}`).join('\n')}

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
다음 JSON 형식으로 **한국어**로 상세하고 건설적인 피드백을 작성해주세요:

\`\`\`json
{
  "feedback": "마크다운 형식의 상세한 한국어 피드백",
  "overall_score": 0-100점,
  "criteria_scores": {
    "requirements_met": 0-100,
    "code_quality": 0-100,
    "best_practices": 0-100,
    "creativity": 0-100
  },
  "feedback_quality": {
    "confidence_score": 0-100,
    "cultural_appropriateness": 0-100,
    "actionability": 0-100
  },
  "improvement_suggestions": ["구체적인 개선 제안들"],
  "next_steps": ["다음 학습 단계 제안들"]
}
\`\`\`

### 피드백 작성 가이드라인
1. **긍정적 시작**: 잘한 점을 먼저 언급하여 학습 동기 부여
2. **구체적 지적**: 개선할 점은 구체적인 예시와 함께 설명
3. **실용적 조언**: 실제 개발현장에서 활용 가능한 팁 제공
4. **학습 방향**: 다음 단계 학습 방향과 추천 자료 제시
5. **격려 마무리**: 학습자를 격려하는 따뜻한 메시지로 마무리

한국의 개발 학습 문화와 ${culturalContext === 'korean_academic' ? '학술적 환경' : '국제적 환경'}에 맞는 톤과 내용으로 작성해주세요.
`;
  }

  /**
   * Parse Claude structured response
   */
  private parseClaudeStructuredResponse(response: string, request: FeedbackRequest): AIFeedbackResponse {
    try {
      // Extract JSON from Claude's response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      let jsonContent = jsonMatch ? jsonMatch[1] : response;
      
      // Fallback: try to find any JSON object
      if (!jsonMatch) {
        const fallbackMatch = response.match(/\{[\s\S]*\}/);
        jsonContent = fallbackMatch ? fallbackMatch[0] : response;
      }

      const parsed = JSON.parse(jsonContent);
      
      return {
        content: parsed.feedback || response,
        score: parsed.overall_score || 75,
        criteria_scores: {
          requirements_met: parsed.criteria_scores?.requirements_met || 75,
          code_quality: parsed.criteria_scores?.code_quality || 75,
          best_practices: parsed.criteria_scores?.best_practices || 75,
          creativity: parsed.criteria_scores?.creativity || 75,
        },
        feedback_quality: {
          confidence_score: parsed.feedback_quality?.confidence_score || 85,
          cultural_appropriateness: parsed.feedback_quality?.cultural_appropriateness || 90,
          actionability: parsed.feedback_quality?.actionability || 80,
        },
        improvement_suggestions: parsed.improvement_suggestions || ['추가 학습을 권장합니다.'],
        learning_resources: this.generateLearningResources(request.assignment.category),
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
      const parsed = JSON.parse(response);
      
      return {
        content: parsed.feedback || response,
        score: parsed.overall_score || 75,
        criteria_scores: {
          requirements_met: parsed.criteria_scores?.requirements_met || 75,
          code_quality: parsed.criteria_scores?.code_quality || 75,
          best_practices: parsed.criteria_scores?.best_practices || 75,
          creativity: parsed.criteria_scores?.creativity || 75,
        },
        feedback_quality: {
          confidence_score: parsed.feedback_quality?.confidence_score || 85,
          cultural_appropriateness: parsed.feedback_quality?.cultural_appropriateness || 90,
          actionability: parsed.feedback_quality?.actionability || 80,
        },
        improvement_suggestions: parsed.improvement_suggestions || ['추가 학습을 권장합니다.'],
        learning_resources: this.generateLearningResources(request.assignment.category),
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
      };
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
      learning_resources: this.generateLearningResources(request.assignment.category),
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
    };
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
}