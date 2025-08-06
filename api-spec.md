# Discord Bot Backend API Specification

## Architecture Overview

### Core Principles
- **RESTful Design**: Clean, predictable endpoint structure
- **6-Character Assignment IDs**: All operations use alphanumeric codes (e.g., ABC123)
- **Korean Language Support**: UTF-8 encoding with Korean response messages
- **Error-First Design**: Comprehensive error handling with meaningful messages
- **Caching Strategy**: Redis-based caching for frequently accessed data

### Technology Stack
- **Framework**: Node.js with Express.js or Python with FastAPI
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for session management and frequent queries
- **Authentication**: JWT tokens with Discord OAuth2 integration
- **AI Integration**: Claude/OpenAI API clients with rate limiting

---

## Authentication & Authorization

### Discord OAuth2 Integration

```typescript
interface DiscordUser {
  id: string;           // Discord user ID
  username: string;
  discriminator: string;
  avatar: string;
  verified: boolean;
  locale: string;       // For Korean language preference
}

interface AuthToken {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}
```

### JWT Structure

```typescript
interface JWTPayload {
  sub: string;          // Discord user ID
  username: string;
  role: "student" | "admin";
  iat: number;
  exp: number;
  guild_id: string;     // Discord server ID
}
```

### Authentication Endpoints

```http
POST /auth/discord/login
POST /auth/discord/callback
POST /auth/refresh
DELETE /auth/logout
```

---

## Core API Endpoints

### 1. Assignments (과제)

#### Get Assignment Details - `!공지 {과제고유번호}`

```http
GET /api/assignments/{assignment_code}
Authorization: Bearer {jwt_token}
```

**Request Parameters:**
- `assignment_code`: 6-character alphanumeric code (e.g., ABC123)

**Response Schema:**
```typescript
interface AssignmentDetails {
  assignment_code: string;      // "ABC123"
  title: string;               // "React Hooks 실습"
  description: string;         // Markdown content
  requirements: string[];      // Array of requirements
  recommendations: string[];   // Array of recommendations
  deadline: string;           // ISO 8601 format
  created_at: string;
  my_submission?: {           // Only if user has submitted
    id: string;
    status: "submitted" | "late" | "graded";
    submitted_at: string;
    score?: number;
  }
}
```

**Response Examples:**

Success (200):
```json
{
  "success": true,
  "data": {
    "assignment_code": "ABC123",
    "title": "React Hooks 실습",
    "description": "# React Hooks 심화 학습\n\n이번 과제에서는...",
    "requirements": [
      "useState와 useEffect 활용",
      "Custom Hook 구현",
      "컴포넌트 최적화"
    ],
    "recommendations": [
      "ESLint 규칙 준수",
      "TypeScript 사용 권장"
    ],
    "deadline": "2025-08-10T23:59:00Z",
    "created_at": "2025-08-01T09:00:00Z",
    "my_submission": {
      "id": "sub_456",
      "status": "submitted",
      "submitted_at": "2025-08-05T14:30:00Z"
    }
  },
  "message": "과제 정보를 성공적으로 조회했습니다."
}
```

Error (404):
```json
{
  "success": false,
  "error": {
    "code": "ASSIGNMENT_NOT_FOUND",
    "message": "과제를 찾을 수 없습니다. 과제 코드를 확인해주세요.",
    "details": {
      "assignment_code": "ABC123",
      "valid_format": true
    }
  }
}
```

#### List All Assignments - `!과제리스트`

```http
GET /api/assignments
Authorization: Bearer {jwt_token}
Query Parameters:
  - status: "active" | "closed" | "all" (default: "active")
  - sort: "latest" | "deadline" (default: "latest")
  - limit: number (default: 20)
```

**Response Schema:**
```typescript
interface AssignmentList {
  assignments: Array<{
    assignment_code: string;
    title: string;
    deadline: string;
    status: "active" | "closed";
    my_status: "submitted" | "not_submitted" | "late";
    created_at: string;
  }>;
  total: number;
  has_more: boolean;
}
```

### 2. Submissions (제출)

#### Submit Blog Post - `!제출글 {과제고유번호} "{제목}" {링크}`

```http
POST /api/submissions/blog
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Schema:**
```typescript
interface BlogSubmissionRequest {
  assignment_code: string;    // "ABC123"
  title: string;             // "React Hooks 정리"
  url: string;              // "https://myblog.tistory.com/123"
  content?: string;         // Optional: pre-fetched content
}
```

**Response Schema:**
```typescript
interface SubmissionResponse {
  submission_id: string;     // For !피드백 command
  assignment_code: string;
  status: "processing" | "completed" | "failed";
  ai_feedback?: {
    content: string;         // Markdown formatted feedback
    score: number;           // 0-100
    generated_at: string;
  };
  submitted_at: string;
}
```

**Implementation Flow:**
1. Validate assignment code exists and is active
2. Check if user already submitted for this assignment
3. Fetch content from URL (Notion API, web scraping)
4. Store submission in database
5. Queue AI feedback generation
6. Return immediate response with processing status

#### Submit Code - `!제출코드 {과제고유번호} {GitHub링크}`

```http
POST /api/submissions/code
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Schema:**
```typescript
interface CodeSubmissionRequest {
  assignment_code: string;    // "ABC123"
  github_url: string;        // "https://github.com/user/repo"
  branch?: string;           // default: "main"
  specific_folder?: string;  // Optional: focus on specific directory
}
```

**Implementation Flow:**
1. Validate GitHub repository accessibility
2. Clone repository (shallow clone for efficiency)
3. Extract relevant files based on assignment requirements
4. Store code structure and content
5. Queue AI feedback generation
6. Clean up temporary files

#### Interactive Submission - `!제출`

```http
POST /api/submissions/interactive/start
Authorization: Bearer {jwt_token}
```

**Response Schema:**
```typescript
interface InteractiveSession {
  session_id: string;
  step: "assignment_selection" | "type_selection" | "content_input";
  available_assignments?: AssignmentOption[];
  submission_types?: ("blog" | "code")[];
  expires_at: string;        // Session timeout
}

interface AssignmentOption {
  assignment_code: string;
  title: string;
  deadline: string;
  already_submitted: boolean;
}
```

### 3. Feedback (피드백)

#### Get Feedback - `!피드백 {제출번호}`

```http
GET /api/submissions/{submission_id}/feedback
Authorization: Bearer {jwt_token}
```

**Response Schema:**
```typescript
interface FeedbackResponse {
  submission_id: string;
  assignment_code: string;
  assignment_title: string;
  ai_feedback: {
    content: string;          // Markdown formatted
    score: number;            // 0-100
    criteria_scores: {
      requirements_met: number;
      code_quality: number;
      best_practices: number;
      creativity: number;
    };
    generated_at: string;
  };
  manual_feedback?: {
    content: string;
    score?: number;
    reviewer: string;
    reviewed_at: string;
  };
}
```

### 4. User Status (현황/내제출)

#### Get My Submission for Assignment - `!내제출 {과제고유번호}`

```http
GET /api/users/me/submissions/{assignment_code}
Authorization: Bearer {jwt_token}
```

**Response Schema:**
```typescript
interface MySubmissionStatus {
  assignment_code: string;
  assignment_title: string;
  deadline: string;
  my_submission?: {
    submission_id: string;
    type: "blog" | "code";
    submitted_at: string;
    status: "processing" | "completed" | "late";
    score?: number;
    feedback_available: boolean;
  };
  time_remaining?: string;   // Human readable (e.g., "2일 14시간 남음")
}
```

#### Get Overall Status - `!현황`

```http
GET /api/users/me/status
Authorization: Bearer {jwt_token}
```

**Response Schema:**
```typescript
interface UserStatus {
  user_info: {
    username: string;
    total_assignments: number;
    completed_assignments: number;
    completion_rate: number;
  };
  recent_submissions: Array<{
    assignment_code: string;
    assignment_title: string;
    submitted_at: string;
    score?: number;
    status: string;
  }>;
  active_assignments: Array<{
    assignment_code: string;
    title: string;
    deadline: string;
    status: "not_submitted" | "submitted";
    time_remaining: string;
  }>;
  statistics: {
    average_score: number;
    on_time_submissions: number;
    late_submissions: number;
  };
}
```

---

## Error Handling Strategy

### Error Response Format

```typescript
interface APIError {
  success: false;
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable Korean message
    details?: any;          // Additional context
    timestamp: string;
  };
}
```

### Common Error Codes

```typescript
enum ErrorCodes {
  // Authentication
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  UNAUTHORIZED = "UNAUTHORIZED",
  
  // Validation
  INVALID_ASSIGNMENT_CODE = "INVALID_ASSIGNMENT_CODE",
  ASSIGNMENT_NOT_FOUND = "ASSIGNMENT_NOT_FOUND",
  ASSIGNMENT_CLOSED = "ASSIGNMENT_CLOSED",
  DUPLICATE_SUBMISSION = "DUPLICATE_SUBMISSION",
  
  // External Services
  GITHUB_ACCESS_FAILED = "GITHUB_ACCESS_FAILED",
  CONTENT_FETCH_FAILED = "CONTENT_FETCH_FAILED",
  AI_SERVICE_UNAVAILABLE = "AI_SERVICE_UNAVAILABLE",
  
  // System
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
}
```

### Error Handling Examples

```typescript
// Validation Error
{
  "success": false,
  "error": {
    "code": "INVALID_ASSIGNMENT_CODE",
    "message": "과제 코드 형식이 올바르지 않습니다. 6자리 영문/숫자 조합을 입력해주세요.",
    "details": {
      "provided": "abc12",
      "expected_format": "ABC123",
      "valid_pattern": "^[A-Z0-9]{6}$"
    },
    "timestamp": "2025-08-05T10:30:00Z"
  }
}

// Rate Limit Error
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "요청 한도를 초과했습니다. 1분 후 다시 시도해주세요.",
    "details": {
      "limit": 60,
      "window": "1m",
      "retry_after": 45
    },
    "timestamp": "2025-08-05T10:30:00Z"
  }
}
```

---

## Caching Strategy

### Redis Cache Architecture

```typescript
interface CacheStrategy {
  // Assignment details (frequently accessed)
  assignments: {
    key: `assignment:${assignment_code}`;
    ttl: 300; // 5 minutes
    strategy: "cache-aside";
  };
  
  // User submissions (moderate frequency)
  user_submissions: {
    key: `user:${user_id}:submissions`;
    ttl: 120; // 2 minutes
    strategy: "write-through";
  };
  
  // AI feedback (rarely changes)
  ai_feedback: {
    key: `feedback:${submission_id}`;
    ttl: 3600; // 1 hour
    strategy: "cache-aside";
  };
  
  // Assignment lists (changes when new assignments added)
  assignment_lists: {
    key: `assignments:list:${user_id}`;
    ttl: 60; // 1 minute
    strategy: "write-behind";
  };
}
```

### Cache Invalidation Rules

```typescript
const cacheInvalidation = {
  // When assignment is updated
  onAssignmentUpdate: (assignment_code: string) => {
    redis.del(`assignment:${assignment_code}`);
    redis.del(`assignments:list:*`); // Wildcard deletion
  },
  
  // When user submits
  onSubmission: (user_id: string, assignment_code: string) => {
    redis.del(`user:${user_id}:submissions`);
    redis.del(`user:${user_id}:status`);
    redis.del(`assignment:${assignment_code}`); // Contains submission count
  },
  
  // When feedback is generated
  onFeedbackGenerated: (submission_id: string, user_id: string) => {
    redis.del(`feedback:${submission_id}`);
    redis.del(`user:${user_id}:status`);
  }
};
```

---

## Integration Points

### Discord Bot Service Communication

```typescript
interface BotServiceInterface {
  // Send responses to Discord
  sendEphemeralResponse(interaction_id: string, content: string): Promise<void>;
  sendDMToUser(user_id: string, content: string): Promise<void>;
  updateInteractionResponse(interaction_id: string, content: string): Promise<void>;
  
  // Handle file uploads
  processDiscordAttachments(attachments: DiscordAttachment[]): Promise<ProcessedFile[]>;
  
  // Manage interactive sessions
  createInteractiveSession(user_id: string, type: string): Promise<string>;
  updateInteractiveSession(session_id: string, data: any): Promise<void>;
}
```

### AI Service Integration

```typescript
interface AIServiceInterface {
  // Generate feedback
  generateFeedback(request: FeedbackRequest): Promise<AIFeedbackResponse>;
  
  // Validate submission content
  validateSubmissionContent(content: string, requirements: string[]): Promise<ValidationResult>;
  
  // Extract content from URLs
  extractContentFromUrl(url: string, type: 'notion' | 'blog'): Promise<ExtractedContent>;
}

interface FeedbackRequest {
  assignment: {
    code: string;
    title: string;
    requirements: string[];
    recommendations: string[];
  };
  submission: {
    type: 'blog' | 'code';
    content: string;
    metadata?: any;
  };
  user_context?: {
    previous_submissions: number;
    average_score: number;
  };
}
```

### External Content Fetching

```typescript
interface ContentFetcher {
  // Notion API integration
  fetchNotionPage(url: string): Promise<NotionContent>;
  
  // Generic web scraping
  scrapeWebContent(url: string): Promise<ScrapedContent>;
  
  // GitHub repository cloning
  cloneGitHubRepo(url: string, options: CloneOptions): Promise<RepoContent>;
  
  // File processing
  processCodeFiles(files: FileContent[]): Promise<ProcessedCode>;
}
```

---

## Rate Limiting & Security

### Rate Limiting Strategy

```typescript
const rateLimits = {
  // Per user limits
  submissions: {
    window: "1h",
    max: 10,
    message: "제출 한도를 초과했습니다. 1시간 후 다시 시도해주세요."
  },
  
  feedback_requests: {
    window: "10m",
    max: 20,
    message: "피드백 조회 한도를 초과했습니다. 10분 후 다시 시도해주세요."
  },
  
  assignment_queries: {
    window: "1m",
    max: 30,
    message: "조회 한도를 초과했습니다. 1분 후 다시 시도해주세요."
  },
  
  // Global AI service limits
  ai_feedback_generation: {
    window: "1h",
    max: 100,
    message: "AI 피드백 생성 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
  }
};
```

### Security Headers & Validation

```typescript
const securityConfig = {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"]
      }
    }
  },
  
  validation: {
    assignment_code: /^[A-Z0-9]{6}$/,
    github_url: /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+$/,
    blog_url: /^https:\/\/([\w\-]+\.)*[a-zA-Z]{2,}\/.+$/
  }
};
```

---

## Database Schema Integration

### Optimized Queries with Indexes

```sql
-- Assignments table with indexes
CREATE INDEX idx_assignments_code ON assignments(assignment_code);
CREATE INDEX idx_assignments_deadline ON assignments(deadline DESC);
CREATE INDEX idx_assignments_active ON assignments(deadline) WHERE deadline > NOW();

-- Submissions table with composite indexes
CREATE INDEX idx_submissions_user_assignment ON submissions(user_id, assignment_code);
CREATE INDEX idx_submissions_assignment_submitted ON submissions(assignment_code, submitted_at DESC);
CREATE INDEX idx_submissions_user_recent ON submissions(user_id, submitted_at DESC);

-- Feedbacks table with indexes
CREATE INDEX idx_feedbacks_submission ON feedbacks(submission_id);
CREATE INDEX idx_feedbacks_generated ON feedbacks(generated_at DESC);
```

### Connection Pooling Configuration

```typescript
const dbConfig = {
  postgresql: {
    host: process.env.DB_HOST,
    port: 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    
    // Connection pool settings
    pool: {
      min: 5,
      max: 20,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 600000,
      reapIntervalMillis: 1000,
    }
  },
  
  redis: {
    host: process.env.REDIS_HOST,
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    
    // Connection pool settings
    family: 4,
    keepAlive: true,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false
  }
};
```

---

## API Implementation Guidelines

### Controller Structure

```typescript
// Example: AssignmentController
class AssignmentController {
  private assignmentService: AssignmentService;
  private cacheService: CacheService;
  
  async getAssignmentDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { assignment_code } = req.params;
      const user_id = req.user.id;
      
      // Validate assignment code format
      if (!this.isValidAssignmentCode(assignment_code)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_ASSIGNMENT_CODE",
            message: "과제 코드 형식이 올바르지 않습니다.",
            details: { provided: assignment_code, expected_format: "ABC123" }
          }
        });
      }
      
      // Check cache first
      const cached = await this.cacheService.get(`assignment:${assignment_code}`);
      if (cached) {
        return res.json({ success: true, data: cached });
      }
      
      // Fetch from service
      const assignment = await this.assignmentService.getAssignmentWithUserStatus(
        assignment_code, 
        user_id
      );
      
      if (!assignment) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ASSIGNMENT_NOT_FOUND",
            message: "과제를 찾을 수 없습니다."
          }
        });
      }
      
      // Cache result
      await this.cacheService.set(`assignment:${assignment_code}`, assignment, 300);
      
      res.json({ success: true, data: assignment });
      
    } catch (error) {
      this.handleError(error, res);
    }
  }
  
  private isValidAssignmentCode(code: string): boolean {
    return /^[A-Z0-9]{6}$/.test(code);
  }
  
  private handleError(error: any, res: Response) {
    console.error('Assignment Controller Error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      }
    });
  }
}
```

### Service Layer Pattern

```typescript
// Example: SubmissionService
class SubmissionService {
  private db: DatabaseConnection;
  private aiService: AIService;
  private contentFetcher: ContentFetcher;
  
  async submitBlogPost(request: BlogSubmissionRequest, user_id: string): Promise<SubmissionResponse> {
    // Check if assignment exists and is active
    const assignment = await this.getActiveAssignment(request.assignment_code);
    if (!assignment) {
      throw new ApplicationError("ASSIGNMENT_NOT_FOUND", "과제를 찾을 수 없습니다.");
    }
    
    // Check for duplicate submission
    const existingSubmission = await this.findUserSubmission(user_id, request.assignment_code);
    if (existingSubmission) {
      throw new ApplicationError("DUPLICATE_SUBMISSION", "이미 제출한 과제입니다.");
    }
    
    // Fetch content from URL
    let content: string;
    try {
      const extracted = await this.contentFetcher.extractContentFromUrl(request.url, 'blog');
      content = extracted.content;
    } catch (error) {
      // Fallback to provided content or manual input
      content = request.content || '';
      if (!content) {
        throw new ApplicationError("CONTENT_FETCH_FAILED", "내용을 가져올 수 없습니다. 직접 입력해주세요.");
      }
    }
    
    // Store submission
    const submission = await this.db.submissions.create({
      id: generateUUID(),
      assignment_code: request.assignment_code,
      user_id,
      type: 'blog',
      title: request.title,
      url: request.url,
      content,
      submitted_at: new Date(),
      status: 'processing'
    });
    
    // Queue AI feedback generation (async)
    this.queueAIFeedback(submission.id, assignment, content);
    
    return {
      submission_id: submission.id,
      assignment_code: request.assignment_code,
      status: 'processing',
      submitted_at: submission.submitted_at.toISOString()
    };
  }
  
  private async queueAIFeedback(submission_id: string, assignment: Assignment, content: string) {
    try {
      const feedback = await this.aiService.generateFeedback({
        assignment: {
          code: assignment.assignment_code,
          title: assignment.title,
          requirements: assignment.requirements,
          recommendations: assignment.recommendations
        },
        submission: {
          type: 'blog',
          content
        }
      });
      
      // Update submission with feedback
      await this.db.submissions.update(submission_id, {
        ai_feedback: feedback.content,
        score: feedback.score,
        status: 'completed'
      });
      
    } catch (error) {
      console.error('AI Feedback Generation Failed:', error);
      await this.db.submissions.update(submission_id, {
        status: 'failed',
        error_message: 'AI 피드백 생성에 실패했습니다.'
      });
    }
  }
}
```

This comprehensive API specification provides a solid foundation for implementing the Discord bot backend, with clear endpoints, error handling, caching strategies, and integration patterns optimized for the Korean study management system.