# Backend API Specification for Discord Bot Integration

## 🏗 Architecture Overview

The backend API serves as the central hub for the assignment management system, providing RESTful endpoints for Discord bot commands, AI feedback generation, and data management.

### Core Components
- **Express.js API Server**: RESTful endpoints with TypeScript
- **PostgreSQL Database**: Primary data storage with Prisma ORM
- **Redis Cache**: Performance optimization and session management
- **AI Service Integration**: Claude/OpenAI API connections
- **Content Fetchers**: GitHub, Notion API, and web scraping services

## 🔐 Authentication & Authorization

### Discord OAuth2 Flow
```typescript
// 1. Bot initiates auth for user
POST /api/auth/discord/init
Request: { discordId: string, username: string }
Response: { userId: string, token: string, refreshToken: string }

// 2. Verify Discord user
POST /api/auth/discord/verify
Headers: { Authorization: "Bearer {token}" }
Request: { discordId: string, guildId: string }
Response: { valid: boolean, user: User }
```

### JWT Token Structure
```typescript
interface JWTPayload {
  userId: string;
  discordId: string;
  username: string;
  role: 'student' | 'admin';
  iat: number;
  exp: number;
}
```

## 📋 API Endpoints

### 1. Assignment Management

#### Get Assignment Details
```typescript
GET /api/assignments/:assignmentCode
Headers: { Authorization: "Bearer {token}" }

Response: {
  success: true,
  data: {
    id: "uuid",
    assignmentCode: "ABC123",
    title: "React Hooks 실습",
    description: "...",
    requirements: "...",
    recommendations: "...",
    deadline: "2025-08-10T23:59:59Z",
    createdAt: "2025-08-01T10:00:00Z",
    submissionStatus: {
      submitted: boolean,
      submittedAt?: Date,
      late?: boolean
    }
  }
}

Error Response (404):
{
  success: false,
  error: "ASSIGNMENT_NOT_FOUND",
  message: "과제 코드 'ABC123'을 찾을 수 없습니다."
}
```

#### List All Assignments
```typescript
GET /api/assignments
Headers: { Authorization: "Bearer {token}" }
Query: { 
  page?: number,
  limit?: number,
  status?: 'active' | 'past' | 'all'
}

Response: {
  success: true,
  data: {
    assignments: Assignment[],
    pagination: {
      page: 1,
      limit: 20,
      total: 45,
      pages: 3
    }
  }
}
```

#### Create Assignment (Admin Only)
```typescript
POST /api/assignments
Headers: { Authorization: "Bearer {admin-token}" }
Request: {
  title: string,
  description: string,
  requirements: string,
  recommendations: string,
  deadline: string // ISO date
}

Response: {
  success: true,
  data: {
    assignmentCode: "XY9Z8K", // Auto-generated
    ...assignment
  }
}
```

### 2. Submission Management

#### Submit Blog Post
```typescript
POST /api/submissions/blog
Headers: { Authorization: "Bearer {token}" }
Request: {
  assignmentCode: "ABC123",
  title: "React Hooks 정리",
  url: "https://myblog.tistory.com/123",
  extractContent?: boolean // Auto-extract content from URL
}

Response: {
  success: true,
  data: {
    submissionId: "SUB-12345678",
    assignmentCode: "ABC123",
    userId: "user-uuid",
    submissionType: "blog",
    title: "React Hooks 정리",
    url: "https://myblog.tistory.com/123",
    content: "...", // Extracted content
    submittedAt: "2025-08-05T14:30:00Z",
    late: false
  }
}

Error Response (409):
{
  success: false,
  error: "ALREADY_SUBMITTED",
  message: "이미 해당 과제를 제출하셨습니다."
}
```

#### Submit Code
```typescript
POST /api/submissions/code
Headers: { Authorization: "Bearer {token}" }
Request: {
  assignmentCode: "ABC123",
  url: "https://github.com/username/react-todo-app"
}

Response: {
  success: true,
  data: {
    submissionId: "SUB-87654321",
    assignmentCode: "ABC123",
    userId: "user-uuid",
    submissionType: "code",
    url: "https://github.com/username/react-todo-app",
    content: null, // Will be fetched asynchronously
    submittedAt: "2025-08-05T14:35:00Z",
    late: false,
    processingStatus: "fetching" // fetching | ready | failed
  }
}
```

#### Get Submission Details
```typescript
GET /api/submissions/:submissionId
Headers: { Authorization: "Bearer {token}" }

Response: {
  success: true,
  data: {
    submission: Submission,
    assignment: Assignment,
    feedback?: Feedback
  }
}
```

### 3. Feedback Management

#### Generate AI Feedback
```typescript
POST /api/feedback/generate
Headers: { Authorization: "Bearer {token}" }
Request: {
  submissionId: "SUB-12345678"
}

Response: {
  success: true,
  data: {
    feedbackId: "feedback-uuid",
    submissionId: "SUB-12345678",
    status: "generating", // generating | completed | failed
    estimatedTime: 30 // seconds
  }
}

// Webhook or polling for completion
GET /api/feedback/:feedbackId
Response: {
  success: true,
  data: {
    feedbackId: "feedback-uuid",
    aiFeedback: "## 과제 평가 결과\n\n### 좋은 점\n...",
    aiScore: {
      requirementsFulfillment: 8,
      codeQuality: 7,
      bestPractices: 9,
      creativity: 6,
      overall: 7.7
    },
    createdAt: "2025-08-05T14:40:00Z"
  }
}
```

#### Get Feedback by Submission
```typescript
GET /api/submissions/:submissionId/feedback
Headers: { Authorization: "Bearer {token}" }

Response: {
  success: true,
  data: {
    feedback: Feedback,
    submission: Submission,
    assignment: Assignment
  }
}
```

### 4. User Management

#### Get User Status
```typescript
GET /api/users/me/status
Headers: { Authorization: "Bearer {token}" }

Response: {
  success: true,
  data: {
    user: {
      id: "user-uuid",
      discordId: "discord-id",
      username: "학생이름"
    },
    statistics: {
      totalAssignments: 10,
      submitted: 8,
      late: 1,
      notSubmitted: 2,
      averageScore: 7.5
    },
    recentSubmissions: Submission[],
    upcomingDeadlines: Assignment[]
  }
}
```

#### Get User Submission for Assignment
```typescript
GET /api/users/me/submissions/:assignmentCode
Headers: { Authorization: "Bearer {token}" }

Response: {
  success: true,
  data: {
    assignment: Assignment,
    submission?: Submission,
    feedback?: Feedback,
    status: "submitted" | "not_submitted" | "late"
  }
}
```

### 5. Health & Monitoring

#### Health Check
```typescript
GET /api/health

Response: {
  status: "healthy",
  timestamp: "2025-08-05T14:00:00Z",
  services: {
    database: "connected",
    redis: "connected",
    ai: "available"
  }
}
```

## 🗄 Database Schema Optimization

### Indexes for Performance
```sql
-- Composite indexes for common queries
CREATE INDEX idx_submissions_user_assignment 
  ON submissions(userId, assignmentCode);
  
CREATE INDEX idx_submissions_assignment_submitted 
  ON submissions(assignmentCode, submittedAt DESC);

CREATE INDEX idx_assignments_deadline 
  ON assignments(deadline);
```

### Query Optimization Examples
```typescript
// Efficient query for user's submission status
const submissionStatus = await prisma.submission.findFirst({
  where: {
    userId: userId,
    assignmentCode: assignmentCode
  },
  include: {
    feedback: true,
    assignment: {
      select: {
        title: true,
        deadline: true
      }
    }
  }
});
```

## ⚡ Caching Strategy

### Redis Cache Keys
```typescript
// Cache key patterns
const cacheKeys = {
  assignment: (code: string) => `assignment:${code}`,
  userSubmissions: (userId: string) => `user:${userId}:submissions`,
  feedback: (submissionId: string) => `feedback:${submissionId}`,
  assignmentList: () => 'assignments:list:active'
};

// Cache TTL settings
const cacheTTL = {
  assignment: 300,        // 5 minutes
  userSubmissions: 120,   // 2 minutes
  feedback: 3600,         // 1 hour
  assignmentList: 180     // 3 minutes
};
```

### Cache Invalidation
```typescript
// Invalidate on submission
async function invalidateSubmissionCache(userId: string, assignmentCode: string) {
  await redis.del([
    cacheKeys.userSubmissions(userId),
    cacheKeys.assignment(assignmentCode)
  ]);
}
```

## 🚨 Error Handling

### Error Response Format
```typescript
interface ErrorResponse {
  success: false;
  error: string;           // Machine-readable error code
  message: string;         // Human-readable Korean message
  details?: any;           // Additional error context
  timestamp: string;
}

// Error codes
enum ErrorCodes {
  ASSIGNMENT_NOT_FOUND = 'ASSIGNMENT_NOT_FOUND',
  ALREADY_SUBMITTED = 'ALREADY_SUBMITTED',
  SUBMISSION_NOT_FOUND = 'SUBMISSION_NOT_FOUND',
  INVALID_URL = 'INVALID_URL',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN'
}
```

### Korean Error Messages
```typescript
const errorMessages: Record<ErrorCodes, string> = {
  ASSIGNMENT_NOT_FOUND: '과제를 찾을 수 없습니다.',
  ALREADY_SUBMITTED: '이미 제출된 과제입니다.',
  SUBMISSION_NOT_FOUND: '제출물을 찾을 수 없습니다.',
  INVALID_URL: '유효하지 않은 URL입니다.',
  AI_SERVICE_ERROR: 'AI 피드백 생성 중 오류가 발생했습니다.',
  RATE_LIMIT_EXCEEDED: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  UNAUTHORIZED: '인증이 필요합니다.',
  FORBIDDEN: '권한이 없습니다.'
};
```

## 🔄 Rate Limiting

### Rate Limit Configuration
```typescript
// Different limits for different endpoints
const rateLimits = {
  submission: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,                   // 10 submissions per hour
    message: '시간당 제출 한도(10회)를 초과했습니다.'
  },
  feedback: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20,                   // 20 feedback requests per 10 min
    message: '피드백 요청 한도를 초과했습니다.'
  },
  general: {
    windowMs: 60 * 1000,      // 1 minute
    max: 100,                  // 100 requests per minute
    message: '요청 한도를 초과했습니다.'
  }
};
```

## 🤖 AI Service Integration

### AI Feedback Generation Flow
```typescript
// 1. Prepare context for AI
async function prepareAIContext(submission: Submission): Promise<AIContext> {
  const assignment = await getAssignment(submission.assignmentCode);
  const content = await fetchContent(submission);
  
  return {
    assignment: {
      code: assignment.assignmentCode,
      title: assignment.title,
      requirements: assignment.requirements,
      recommendations: assignment.recommendations
    },
    submission: {
      type: submission.submissionType,
      content: content,
      url: submission.url
    }
  };
}

// 2. Generate prompt
function generatePrompt(context: AIContext): string {
  return `당신은 친절하고 전문적인 프로그래밍 튜터입니다.

[과제 정보]
- 과제 고유번호: ${context.assignment.code}
- 과제명: ${context.assignment.title}
- 요구사항: ${context.assignment.requirements}
- 권장사항: ${context.assignment.recommendations}

[제출물]
- 제출 유형: ${context.submission.type}
- 내용: ${context.submission.content}

[평가 기준]
1. 요구사항 충족도 (1-10점)
2. 코드 품질 (1-10점)
3. 베스트 프랙티스 준수 (1-10점)
4. 창의성 및 추가 노력 (1-10점)

마크다운 형식으로 구체적이고 건설적인 피드백을 제공해주세요.`;
}

// 3. Call AI service with retry
async function callAIService(prompt: string): Promise<AIResponse> {
  const maxRetries = 3;
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Try Claude first
      return await claudeService.generateFeedback(prompt);
    } catch (error) {
      lastError = error;
      
      // Fallback to OpenAI
      try {
        return await openaiService.generateFeedback(prompt);
      } catch (fallbackError) {
        lastError = fallbackError;
      }
    }
    
    // Exponential backoff
    await sleep(Math.pow(2, i) * 1000);
  }
  
  throw lastError;
}
```

## 📝 Implementation Examples

### Controller Pattern
```typescript
// assignments.controller.ts
export class AssignmentsController {
  constructor(
    private assignmentsService: AssignmentsService,
    private cacheService: CacheService
  ) {}

  async getAssignment(req: Request, res: Response) {
    try {
      const { assignmentCode } = req.params;
      const userId = req.user.id;
      
      // Check cache first
      const cached = await this.cacheService.get(
        `assignment:${assignmentCode}:${userId}`
      );
      
      if (cached) {
        return res.json({ success: true, data: cached });
      }
      
      // Get from database
      const assignment = await this.assignmentsService.getAssignmentWithStatus(
        assignmentCode,
        userId
      );
      
      if (!assignment) {
        return res.status(404).json({
          success: false,
          error: 'ASSIGNMENT_NOT_FOUND',
          message: `과제 코드 '${assignmentCode}'를 찾을 수 없습니다.`
        });
      }
      
      // Cache the result
      await this.cacheService.set(
        `assignment:${assignmentCode}:${userId}`,
        assignment,
        300 // 5 minutes
      );
      
      return res.json({ success: true, data: assignment });
      
    } catch (error) {
      logger.error('Error getting assignment:', error);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다.'
      });
    }
  }
}
```

### Service Pattern
```typescript
// submissions.service.ts
export class SubmissionsService {
  constructor(
    private prisma: PrismaClient,
    private contentFetcher: ContentFetcherService,
    private eventEmitter: EventEmitter
  ) {}

  async createBlogSubmission(
    userId: string,
    assignmentCode: string,
    title: string,
    url: string
  ): Promise<Submission> {
    // Check if already submitted
    const existing = await this.prisma.submission.findFirst({
      where: { userId, assignmentCode }
    });
    
    if (existing) {
      throw new ConflictError('ALREADY_SUBMITTED', '이미 제출된 과제입니다.');
    }
    
    // Validate URL
    if (!isValidUrl(url)) {
      throw new ValidationError('INVALID_URL', '유효하지 않은 URL입니다.');
    }
    
    // Fetch content asynchronously
    const submission = await this.prisma.submission.create({
      data: {
        id: generateSubmissionId(),
        assignmentCode,
        userId,
        submissionType: 'blog',
        title,
        url,
        content: null // Will be fetched asynchronously
      }
    });
    
    // Trigger content fetching
    this.eventEmitter.emit('submission.created', {
      submissionId: submission.id,
      type: 'blog',
      url
    });
    
    return submission;
  }
}
```

## 🔒 Security Configuration

### Input Validation
```typescript
// Validation schemas using Joi
export const schemas = {
  assignmentCode: Joi.string()
    .length(6)
    .pattern(/^[A-Z0-9]{6}$/)
    .required()
    .messages({
      'string.pattern.base': '과제 코드는 6자리 영문 대문자와 숫자로 구성되어야 합니다.'
    }),
    
  submissionUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required()
    .messages({
      'string.uri': '유효한 URL을 입력해주세요.'
    }),
    
  githubUrl: Joi.string()
    .pattern(/^https:\/\/github\.com\/[\w-]+\/[\w-]+/)
    .required()
    .messages({
      'string.pattern.base': '유효한 GitHub 저장소 URL을 입력해주세요.'
    })
};
```

### CORS Configuration
```typescript
const corsOptions = {
  origin: [
    process.env.DISCORD_BOT_URL,
    process.env.ADMIN_WEB_URL
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

## 📊 Monitoring & Logging

### Structured Logging
```typescript
// Logger configuration
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'backend-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Request logging middleware
app.use((req, res, next) => {
  logger.info('API Request', {
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});
```

This comprehensive API specification provides all the necessary endpoints, data structures, and implementation patterns for building the backend service that integrates with your Discord bot for the assignment management system.