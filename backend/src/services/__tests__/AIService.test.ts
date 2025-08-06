import { AIService, FeedbackRequest, AIFeedbackResponse } from '../AIService';
import { CacheService } from '../CacheService';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { logger } from '../../utils/logger';

// Mock external dependencies
jest.mock('../../utils/logger');
jest.mock('../CacheService');

// Mock the AI SDK modules more specifically
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}));

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

describe('AIService', () => {
  let aiService: AIService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockAnthropicClient: any;
  let mockOpenAIClient: any;

  // Sample test data
  const sampleFeedbackRequest: FeedbackRequest = {
    assignment: {
      code: 'ABC123',
      title: '자바스크립트 기초 과제',
      requirements: ['변수 선언하기', '함수 만들기', '조건문 사용하기'],
      recommendations: ['ES6 문법 사용', '코드 주석 추가'],
      category: 'programming',
      difficulty: 'beginner',
    },
    submission: {
      type: 'code',
      content: `function hello() {
        console.log("Hello World!");
      }`,
      title: '첫 번째 과제 제출',
      url: 'https://github.com/user/repo',
    },
    user_context: {
      previous_submissions: 3,
      average_score: 85,
      learning_level: 'intermediate',
      preferred_feedback_style: 'detailed',
      cultural_context: 'korean_academic',
    },
    performance_hint: {
      max_response_time_ms: 100,
      use_cached_patterns: true,
    },
  };

  const mockClaudeResponse = {
    content: [{
      type: 'text',
      text: JSON.stringify({
        feedback: '# 과제 피드백\n\n잘하셨습니다! 기본적인 함수 구조를 잘 이해하고 계십니다.',
        overall_score: 85,
        criteria_scores: {
          requirements_met: 90,
          code_quality: 85,
          best_practices: 80,
          creativity: 85
        },
        feedback_quality: {
          confidence_score: 90,
          cultural_appropriateness: 95,
          actionability: 85
        },
        improvement_suggestions: ['변수 선언 추가하기', 'ES6 화살표 함수 사용해보기'],
        next_steps: ['고급 함수 패턴 학습하기']
      })
    }]
  };

  const mockOpenAIResponse = {
    choices: [{
      message: {
        content: JSON.stringify({
          feedback: '# 과제 피드백\n\n훌륭한 시작입니다!',
          overall_score: 80,
          criteria_scores: {
            requirements_met: 85,
            code_quality: 80,
            best_practices: 75,
            creativity: 80
          },
          feedback_quality: {
            confidence_score: 85,
            cultural_appropriateness: 90,
            actionability: 80
          },
          improvement_suggestions: ['코드 정리하기'],
          next_steps: ['다음 과제 진행하기']
        })
      }
    }]
  };

  beforeEach(() => {
    // Reset environment variables
    process.env.AI_MODEL_PREFERENCE = 'claude';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.AI_CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
    process.env.AI_OPENAI_MODEL = 'gpt-4o';
    process.env.AI_MAX_TOKENS = '4000';
    process.env.AI_TEMPERATURE = '0.2';
    process.env.AI_CACHE_TTL = '1800';
    process.env.AI_PERFORMANCE_TARGET_MS = '100';

    // Clear all mocks
    jest.clearAllMocks();

    // Setup cache service mock
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      keys: jest.fn().mockResolvedValue([]),
      getStats: jest.fn().mockResolvedValue({ hits: 0, misses: 0, evictions: 0 }),
    } as unknown as jest.Mocked<CacheService>;

    // Create AI service instance
    aiService = new AIService(mockCacheService);

    // Get mock instances
    mockAnthropicClient = (Anthropic as jest.MockedClass<typeof Anthropic>).mock.results[0].value;
    mockOpenAIClient = (OpenAI as jest.MockedClass<typeof OpenAI>).mock.results[0].value;
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with Claude as default provider', () => {
      const service = new AIService();
      const modelInfo = service.getModelInfo();
      expect(modelInfo.provider).toBe('anthropic');
      expect(modelInfo.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should initialize with OpenAI when specified', () => {
      process.env.AI_MODEL_PREFERENCE = 'openai';
      const service = new AIService();
      const modelInfo = service.getModelInfo();
      expect(modelInfo.provider).toBe('openai');
      expect(modelInfo.model).toBe('gpt-4o');
    });

    it('should fall back to OpenAI when Claude is not available', () => {
      delete process.env.ANTHROPIC_API_KEY;
      const service = new AIService();
      const modelInfo = service.getModelInfo();
      expect(modelInfo.provider).toBe('openai');
    });

    it('should fall back to Claude when OpenAI is not available', () => {
      process.env.AI_MODEL_PREFERENCE = 'openai';
      delete process.env.OPENAI_API_KEY;
      const service = new AIService();
      const modelInfo = service.getModelInfo();
      expect(modelInfo.provider).toBe('anthropic');
    });

    it('should log error when no AI service is available', () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      new AIService();
      expect(logger.error).toHaveBeenCalledWith(
        'No AI service configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY'
      );
    });
  });

  describe('generateFeedback', () => {
    it('should generate feedback using Claude with structured output', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      const result = await aiService.generateFeedback(sampleFeedbackRequest);

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.2,
        system: expect.stringContaining('한국의 프로그래밍 교육 전문가'),
        messages: [{
          role: 'user',
          content: expect.stringContaining('과제 평가 요청')
        }]
      });

      expect(result).toMatchObject({
        content: expect.stringContaining('과제 피드백'),
        score: 85,
        criteria_scores: {
          requirements_met: 90,
          code_quality: 85,
          best_practices: 80,
          creativity: 85
        },
        feedback_quality: {
          confidence_score: 90,
          cultural_appropriateness: 95,
          actionability: 85
        },
        improvement_suggestions: expect.arrayContaining(['변수 선언 추가하기']),
        model_info: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022'
        }
      });
    });

    it('should generate feedback using OpenAI when Claude is unavailable', async () => {
      process.env.AI_MODEL_PREFERENCE = 'openai';
      const service = new AIService(mockCacheService);
      
      const openAIMock = (OpenAI as jest.MockedClass<typeof OpenAI>).mock.results[1].value;
      openAIMock.chat.completions.create.mockResolvedValue(mockOpenAIResponse);

      const result = await service.generateFeedback(sampleFeedbackRequest);

      expect(openAIMock.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('한국의 프로그래밍 교육 전문가')
          },
          {
            role: 'user',
            content: expect.stringContaining('과제 평가 요청')
          }
        ],
        max_tokens: 4000,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      expect(result.score).toBe(80);
    });

    it('should use cached feedback when available', async () => {
      const cachedResponse: AIFeedbackResponse = {
        content: '캐시된 피드백',
        score: 90,
        criteria_scores: {
          requirements_met: 95,
          code_quality: 90,
          best_practices: 85,
          creativity: 90
        },
        feedback_quality: {
          confidence_score: 92,
          cultural_appropriateness: 95,
          actionability: 88
        },
        improvement_suggestions: ['캐시된 제안'],
        learning_resources: ['캐시된 리소스'],
        cache_info: {
          cache_key: 'test_key',
          cache_hit: false,
          response_time_ms: 50
        },
        generated_at: new Date().toISOString(),
        model_info: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022'
        }
      };

      mockCacheService.get.mockResolvedValue(cachedResponse);

      const result = await aiService.generateFeedback(sampleFeedbackRequest);

      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockAnthropicClient.messages.create).not.toHaveBeenCalled();
      expect(result.cache_info.cache_hit).toBe(true);
      expect(result.content).toBe('캐시된 피드백');
    });

    it('should cache generated feedback', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      await aiService.generateFeedback(sampleFeedbackRequest);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          content: expect.stringContaining('과제 피드백'),
          score: 85
        }),
        1800,
        'ai_feedback'
      );
    });

    it('should handle API errors gracefully', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(new Error('API Error'));

      await expect(aiService.generateFeedback(sampleFeedbackRequest))
        .rejects.toThrow('AI 피드백 생성 중 오류가 발생했습니다.');
    });

    it('should handle malformed JSON responses', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'This is not JSON'
        }]
      });

      const result = await aiService.generateFeedback(sampleFeedbackRequest);

      expect(result.content).toBe('This is not JSON');
      expect(result.score).toBe(70); // Fallback score
      expect(result.feedback_quality.confidence_score).toBe(50); // Lower confidence
    });
  });

  describe('validateSubmissionContent', () => {
    const requirements = ['변수 선언하기', '함수 만들기', '조건문 사용하기'];
    const content = 'const x = 5; function test() { if (x > 0) return true; }';

    it('should validate content using AI service', async () => {
      const mockValidationResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            is_valid: true,
            missing_requirements: [],
            suggestions: []
          })
        }]
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockValidationResponse);

      const result = await aiService.validateSubmissionContent(content, requirements);

      expect(result.is_valid).toBe(true);
      expect(result.missing_requirements).toHaveLength(0);
    });

    it('should fall back to basic validation when AI fails', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(new Error('API Error'));

      const result = await aiService.validateSubmissionContent(
        'console.log("hello")',
        requirements
      );

      expect(result.is_valid).toBe(false);
      expect(result.missing_requirements).toContain('변수 선언하기');
      expect(result.missing_requirements).toContain('조건문 사용하기');
    });

    it('should perform basic keyword validation correctly', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(new Error('API Error'));

      // Content that contains all requirement keywords (including Korean action words)
      const validContent = '변수를 선언하기 위해 const x = 5; 함수를 만들기 위해 function test() { 조건문을 사용하기 위해 if (x > 0) return true; }';
      const result = await aiService.validateSubmissionContent(validContent, requirements);

      expect(result.is_valid).toBe(true);
      expect(result.missing_requirements).toHaveLength(0);
    });
  });

  describe('isAvailable', () => {
    it('should return true when Claude is available', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({ content: [] });

      const available = await aiService.isAvailable();

      expect(available).toBe(true);
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }]
      });
    });

    it('should return true when OpenAI is available', async () => {
      process.env.AI_MODEL_PREFERENCE = 'openai';
      const service = new AIService(mockCacheService);
      
      const openAIMock = (OpenAI as jest.MockedClass<typeof OpenAI>).mock.results[1].value;
      openAIMock.chat.completions.create.mockResolvedValue({ choices: [] });

      const available = await service.isAvailable();

      expect(available).toBe(true);
    });

    it('should return false when API call fails', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(new Error('API Error'));

      const available = await aiService.isAvailable();

      expect(available).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'AI service availability check failed:',
        expect.any(Error)
      );
    });

    it('should return false when no service is configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const service = new AIService();

      const available = await service.isAvailable();

      expect(available).toBe(false);
    });
  });

  describe('switchProvider', () => {
    it('should switch from Claude to OpenAI', async () => {
      const switched = await aiService.switchProvider('openai');

      expect(switched).toBe(true);
      expect(aiService.getModelInfo().provider).toBe('openai');
      expect(logger.info).toHaveBeenCalledWith('Switched to OpenAI GPT');
    });

    it('should switch from OpenAI to Claude', async () => {
      process.env.AI_MODEL_PREFERENCE = 'openai';
      const service = new AIService(mockCacheService);

      const switched = await service.switchProvider('anthropic');

      expect(switched).toBe(true);
      expect(service.getModelInfo().provider).toBe('anthropic');
    });

    it('should fail to switch when target provider is not available', async () => {
      delete process.env.OPENAI_API_KEY;
      const service = new AIService(mockCacheService);

      const switched = await service.switchProvider('openai');

      expect(switched).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Cannot switch to openai: service not initialized'
      );
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', () => {
      const metrics = aiService.getPerformanceMetrics();

      expect(metrics).toMatchObject({
        avgResponseTime: 0,
        cacheHitRate: 0,
        totalRequests: 0,
        cache_config: {
          ttl_seconds: 1800,
          performance_target_ms: 100
        },
        model_config: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4000,
          temperature: 0.2
        }
      });
    });

    it('should update metrics after generating feedback', async () => {
      mockAnthropicClient.messages.create.mockImplementation(async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        return mockClaudeResponse;
      });

      await aiService.generateFeedback(sampleFeedbackRequest);

      const metrics = aiService.getPerformanceMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.avgResponseTime).toBeGreaterThan(0);
      expect(metrics.cacheHitRate).toBe(0);
    });

    it('should track cache hit rate correctly', async () => {
      // First request - cache miss
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);
      await aiService.generateFeedback(sampleFeedbackRequest);

      // Second request - cache hit
      mockCacheService.get.mockResolvedValue({
        content: 'Cached feedback',
        score: 85,
        criteria_scores: {
          requirements_met: 90,
          code_quality: 85,
          best_practices: 80,
          creativity: 85
        },
        feedback_quality: {
          confidence_score: 90,
          cultural_appropriateness: 95,
          actionability: 85
        },
        improvement_suggestions: [],
        learning_resources: [],
        cache_info: {
          cache_key: 'test',
          cache_hit: false,
          response_time_ms: 0
        },
        generated_at: new Date().toISOString(),
        model_info: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022'
        }
      });
      await aiService.generateFeedback(sampleFeedbackRequest);

      const metrics = aiService.getPerformanceMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.cacheHitRate).toBe(0.5); // 50% hit rate
    });
  });

  describe('Prompt Template System', () => {
    it('should use programming template for code assignments', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      await aiService.generateFeedback({
        ...sampleFeedbackRequest,
        assignment: {
          ...sampleFeedbackRequest.assignment,
          category: 'programming'
        }
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.2,
        system: expect.stringContaining('프로그래밍 교육 전문가'),
        messages: expect.any(Array)
      });
    });

    it('should use blog template for blog assignments', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      await aiService.generateFeedback({
        ...sampleFeedbackRequest,
        assignment: {
          ...sampleFeedbackRequest.assignment,
          category: 'blog'
        },
        submission: {
          ...sampleFeedbackRequest.submission,
          type: 'blog'
        }
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.2,
        system: expect.stringContaining('기술 블로그 작성 전문가'),
        messages: expect.any(Array)
      });
    });

    it('should use algorithm template for algorithm assignments', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      await aiService.generateFeedback({
        ...sampleFeedbackRequest,
        assignment: {
          ...sampleFeedbackRequest.assignment,
          category: 'algorithm'
        }
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.2,
        system: expect.stringContaining('알고리즘과 자료구조 교육 전문가'),
        messages: expect.any(Array)
      });
    });
  });

  describe('Cultural Context and Localization', () => {
    it('should apply Korean academic context by default', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      await aiService.generateFeedback({
        ...sampleFeedbackRequest,
        user_context: {
          ...sampleFeedbackRequest.user_context!,
          cultural_context: 'korean_academic'
        }
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{
            role: 'user',
            content: expect.stringContaining('학술적 환경')
          }]
        })
      );
    });

    it('should translate learning levels correctly', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      await aiService.generateFeedback({
        ...sampleFeedbackRequest,
        user_context: {
          ...sampleFeedbackRequest.user_context!,
          learning_level: 'beginner'
        }
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{
            role: 'user',
            content: expect.stringContaining('초급자')
          }]
        })
      );
    });

    it('should translate feedback styles correctly', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      await aiService.generateFeedback({
        ...sampleFeedbackRequest,
        user_context: {
          ...sampleFeedbackRequest.user_context!,
          preferred_feedback_style: 'encouraging'
        }
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{
            role: 'user',
            content: expect.stringContaining('격려 중심')
          }]
        })
      );
    });
  });

  describe('Language Detection', () => {
    it('should detect JavaScript code', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      await aiService.generateFeedback({
        ...sampleFeedbackRequest,
        submission: {
          ...sampleFeedbackRequest.submission,
          content: 'const x = 5; function test() { return x; }'
        }
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{
            role: 'user',
            content: expect.stringMatching(/```javascript/)
          }]
        })
      );
    });

    it('should detect Python code', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      await aiService.generateFeedback({
        ...sampleFeedbackRequest,
        submission: {
          ...sampleFeedbackRequest.submission,
          content: 'def hello():\n    print("Hello World")'
        }
      });

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{
            role: 'user',
            content: expect.stringMatching(/```python/)
          }]
        })
      );
    });
  });

  describe('Learning Resources Generation', () => {
    it('should generate programming resources', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      const result = await aiService.generateFeedback({
        ...sampleFeedbackRequest,
        assignment: {
          ...sampleFeedbackRequest.assignment,
          category: 'programming'
        }
      });

      expect(result.learning_resources).toContain('모던 JavaScript 튜토리얼: https://ko.javascript.info/');
      expect(result.learning_resources).toContain('생활코딩 웹 개발 강의: https://opentutorials.org/');
    });

    it('should generate algorithm resources', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      const result = await aiService.generateFeedback({
        ...sampleFeedbackRequest,
        assignment: {
          ...sampleFeedbackRequest.assignment,
          category: 'algorithm'
        }
      });

      expect(result.learning_resources).toContain('백준 온라인 저지: https://www.acmicpc.net/');
      expect(result.learning_resources).toContain('프로그래머스 코딩테스트: https://programmers.co.kr/');
    });
  });

  describe('Error Handling and Retries', () => {
    it('should retry on temporary failures', async () => {
      mockAnthropicClient.messages.create
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(mockClaudeResponse);

      const result = await aiService.generateFeedback(sampleFeedbackRequest);

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(3);
      expect(result.score).toBe(85);
    });

    it('should fail after max retries', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(new Error('Persistent error'));

      await expect(aiService.generateFeedback(sampleFeedbackRequest))
        .rejects.toThrow('AI 피드백 생성 중 오류가 발생했습니다.');

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('Legacy Compatibility', () => {
    it('should include legacy fields in response', async () => {
      mockAnthropicClient.messages.create.mockImplementation(async () => {
        // Simulate some processing time to ensure generation_time_ms > 0
        await new Promise(resolve => setTimeout(resolve, 10));
        return mockClaudeResponse;
      });

      const result = await aiService.generateFeedback(sampleFeedbackRequest);

      // Check legacy fields
      expect(result.model_used).toBe('claude-3-5-sonnet-20241022');
      expect(result.cache_hit).toBe(false);
      expect(result.generation_time_ms).toBeGreaterThan(0);
      expect(result.next_steps).toEqual(result.improvement_suggestions);
    });

    it('should handle legacy generateWithAnthropic method', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue(mockClaudeResponse);

      // Access private method through any type casting
      const legacyMethod = (aiService as any).generateWithAnthropic.bind(aiService);
      const result = await legacyMethod('Test prompt');

      expect(result).toContain('과제 피드백');
    });
  });
});