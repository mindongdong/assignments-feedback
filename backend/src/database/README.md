# Database Integration for Discord Assignment System

Complete database integration optimized for Discord API functionality with Korean language support and sub-100ms response times.

## 🚀 Quick Start

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Configure database connection
DATABASE_URL="postgresql://username:password@localhost:5432/assignments_feedback"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

### 2. Database Initialization
```bash
# Start PostgreSQL and Redis with Korean support
docker-compose up -d postgres redis

# Run Prisma migrations
npm run migrate

# Seed database with Korean test data
npm run db:seed
```

### 3. Performance Verification
```bash
# Check database health
curl http://localhost:3000/health

# Verify Korean text support
npm run test:korean

# Monitor performance
npm run test:performance
```

## 📊 Architecture Overview

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discord Bot   │───▶│  Service Layer  │───▶│   PostgreSQL    │
│                 │    │                 │    │   (Korean)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │      Redis      │
                       │    (Cache)      │
                       └─────────────────┘
```

### Performance Targets
- **API Response**: <100ms for Discord commands
- **Database Queries**: <50ms average
- **Cache Hit Rate**: >90% for common operations
- **Korean Text Search**: <200ms full-text queries

## 🔧 Service Layer

### AssignmentService
```typescript
import { AssignmentService } from './services';

// Get assignment with caching
const assignment = await AssignmentService.getByCode('ABC123');

// Search Korean assignments
const results = await AssignmentService.searchAssignments('리액트 과제');

// Get statistics
const stats = await AssignmentService.getAssignmentStats('ABC123');
```

### UserService
```typescript
import { UserService } from './services';

// Create or get Discord user
const user = await UserService.createOrGetUser({
  discordId: '123456789012345678',
  username: '김개발자',
});

// Get user with statistics
const userProfile = await UserService.getUserWithStats(discordId);

// Get leaderboard
const leaders = await UserService.getLeaderboard(10);
```

### SubmissionService
```typescript
import { SubmissionService } from './services';

// Create submission
const submission = await SubmissionService.createSubmission({
  assignmentCode: 'ABC123',
  discordId: '123456789012345678',
  submissionType: 'code',
  url: 'https://github.com/user/project',
});

// Check submission status
const status = await SubmissionService.hasUserSubmitted(discordId, assignmentCode);
```

### FeedbackService
```typescript
import { FeedbackService } from './services';

// Create AI feedback
const feedback = await FeedbackService.createFeedback({
  submissionId: 'submission-uuid',
  aiFeedback: 'AI가 생성한 한국어 피드백...',
  aiScore: { overall: 8, quality: 7, requirements: 9 },
});

// Get feedback with caching
const feedback = await FeedbackService.getBySubmissionId(submissionId);
```

## 🎯 Discord Integration

### DiscordDatabaseService
High-level wrapper for Discord bot operations:

```typescript
import { DiscordDatabaseService } from './services';

// Discord command handler example
async function handleSubmitCommand(discordId: string, assignmentCode: string, url: string) {
  const startTime = Date.now();
  
  try {
    // Get or create user
    const user = await DiscordDatabaseService.getOrCreateUser(discordId, username);
    
    // Validate assignment
    const assignment = await DiscordDatabaseService.getActiveAssignment(assignmentCode);
    if (!assignment) {
      return '과제를 찾을 수 없습니다.';
    }
    
    // Submit assignment
    const submission = await DiscordDatabaseService.submitAssignment({
      assignmentCode,
      discordId,
      submissionType: 'code',
      url,
    });
    
    // Log performance
    const executionTime = Date.now() - startTime;
    await DiscordDatabaseService.logCommandPerformance(
      'submit',
      executionTime,
      true,
      discordId
    );
    
    return `✅ 과제가 성공적으로 제출되었습니다! (${executionTime}ms)`;
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    await DiscordDatabaseService.logCommandPerformance(
      'submit',
      executionTime,
      false,
      discordId,
      error.message
    );
    
    return `❌ 제출 실패: ${error.message}`;
  }
}
```

## 🗃️ Database Schema

### Core Tables
- **users**: Discord user profiles with Korean username support
- **assignments**: Assignment metadata with 6-character codes
- **submissions**: Student submissions with status tracking
- **feedbacks**: AI and manual feedback with Korean content

### Performance Tables
- **user_stats**: Aggregated user statistics
- **assignment_stats**: Assignment performance metrics
- **performance_logs**: System performance monitoring
- **system_cache**: Application-level caching

### Korean Language Support
- **pg_trgm**: Trigram indexes for Korean text search
- **Full-text search**: Korean-optimized search vectors
- **Collation**: ko_KR.UTF-8 for proper Korean sorting

## 🚄 Caching Strategy

### Redis Integration
```typescript
import { DiscordCache } from './cache';

// Cache user data
await DiscordCache.setUser(discordId, userData);
const user = await DiscordCache.getUser(discordId);

// Cache assignments
await DiscordCache.setAssignment(assignmentCode, assignment);
const assignment = await DiscordCache.getAssignment(assignmentCode);

// Cache user submissions
await DiscordCache.setUserSubmissions(discordId, submissions);
```

### Cache TTL Strategy
- **Users**: 1 hour (active Discord users)
- **Assignments**: 30 minutes (relatively static)
- **Submissions**: 15 minutes (frequently updated)
- **Feedback**: 2 hours (large content, rarely changes)

## 📈 Performance Monitoring

### Real-time Metrics
```typescript
import { PerformanceService } from './services';

// Get Discord command metrics
const metrics = await PerformanceService.getDiscordCommandMetrics(24);

// Get system performance
const systemStats = await PerformanceService.getSystemPerformance(24);

// Get performance alerts
const alerts = await PerformanceService.getPerformanceAlerts();
```

### Monitoring Dashboard
```sql
-- View recent Discord activity
SELECT * FROM discord_recent_activity LIMIT 20;

-- Check performance stats
SELECT * FROM discord_performance_stats;

-- Monitor slow operations
SELECT operation, avg_execution_time_ms 
FROM discord_performance_stats 
WHERE avg_execution_time_ms > 100;
```

## 🔍 Korean Text Search

### Full-Text Search
```typescript
// Search assignments in Korean
const assignments = await AssignmentService.searchAssignments('리액트 훅스');

// Search users by Korean name
const users = await UserService.searchUsers('김개발');

// Search feedback content
const feedbacks = await FeedbackService.searchFeedbacks('잘했습니다');
```

### Search Optimization
- **Trigram indexes**: Fast substring matching for Korean
- **Normalization**: Consistent text processing
- **Stemming**: Korean morphological analysis
- **Ranking**: Relevance scoring for search results

## 🛡️ Security & Validation

### Input Validation
```typescript
import { validateAssignmentCodeDetailed } from './utils/assignmentCode';

// Validate assignment codes
const validation = validateAssignmentCodeDetailed('ABC123');
if (!validation.isValid) {
  console.log(validation.error);
  console.log('Suggestions:', validation.suggestions);
}
```

### SQL Injection Prevention
- Prisma ORM with parameterized queries
- Input sanitization for Korean text
- Type-safe database operations
- Escape sequences for special characters

## 🚀 Deployment

### Production Setup
```bash
# Start with production profile
docker-compose --profile production up -d

# Run migrations
npm run migrate:prod

# Verify Korean language support
docker exec assignments-postgres psql -U postgres -d assignments_feedback -c "SHOW lc_collate;"
```

### Health Checks
```bash
# Database health
curl http://localhost:3000/health/database

# Cache health  
curl http://localhost:3000/health/cache

# Performance metrics
curl http://localhost:3000/health/performance
```

## 📊 Usage Examples

### Discord Bot Integration
```typescript
// Discord.js example
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  const startTime = Date.now();
  const { commandName, user } = interaction;
  
  try {
    switch (commandName) {
      case '제출':
        const assignmentCode = interaction.options.getString('과제코드');
        const githubUrl = interaction.options.getString('깃허브링크');
        
        const result = await DiscordDatabaseService.submitAssignment({
          assignmentCode,
          discordId: user.id,
          submissionType: 'code',
          url: githubUrl,
        });
        
        await interaction.reply(`✅ 제출 완료!`);
        break;
        
      case '과제목록':
        const assignments = await DiscordDatabaseService.getAssignmentList();
        const assignmentList = assignments.map(a => 
          `**${a.assignmentCode}**: ${a.title} (마감: ${a.deadline.toLocaleDateString('ko-KR')})`
        ).join('\n');
        
        await interaction.reply(`📋 **활성 과제 목록**\n${assignmentList}`);
        break;
        
      case '내정보':
        const profile = await DiscordDatabaseService.getUserProfile(user.id);
        await interaction.reply(`
          📊 **${profile.username}님의 통계**
          • 총 제출: ${profile.stats.totalSubmissions}회
          • 완료한 과제: ${profile.stats.completedAssignments}개
          • 평균 점수: ${profile.stats.averageScore?.toFixed(1) || 'N/A'}점
          • 연속 제출: ${profile.stats.streakDays}일
        `);
        break;
    }
    
    // Log performance
    const executionTime = Date.now() - startTime;
    await DiscordDatabaseService.logCommandPerformance(
      commandName,
      executionTime,
      true,
      user.id
    );
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    await DiscordDatabaseService.logCommandPerformance(
      commandName,
      executionTime,
      false,
      user.id,
      error.message
    );
    
    await interaction.reply('❌ 명령어 처리 중 오류가 발생했습니다.');
  }
});
```

### Performance Monitoring
```typescript
// Monitor Discord bot performance
setInterval(async () => {
  const alerts = await PerformanceService.getPerformanceAlerts();
  
  for (const alert of alerts) {
    if (alert.severity === 'critical') {
      console.error(`🚨 Critical Alert: ${alert.message}`);
      // Send to monitoring service
    }
  }
}, 60000); // Check every minute
```

## 🛠️ Troubleshooting

### Common Issues

**Korean Text Display Issues**:
```sql
-- Check database encoding
SHOW server_encoding;
SHOW client_encoding;

-- Verify Korean locale
SHOW lc_collate;
SHOW lc_ctype;
```

**Slow Query Performance**:
```sql
-- Check for missing indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('users', 'assignments', 'submissions', 'feedbacks');

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM assignments WHERE title ILIKE '%리액트%';
```

**Cache Issues**:
```bash
# Check Redis connection
redis-cli ping

# Monitor cache hit rate
redis-cli info stats | grep keyspace
```

### Maintenance Scripts
```bash
# Clean old performance logs
npm run db:clean-logs

# Rebuild search indexes
npm run db:rebuild-indexes

# Cache warmup
npm run cache:warmup
```

## 📚 API Reference

See `/src/database/services/` for complete TypeScript interfaces and documentation.

## 🤝 Contributing

1. Follow Korean language conventions for user-facing strings
2. Maintain sub-100ms performance targets
3. Add comprehensive tests for new features
4. Update performance benchmarks
5. Document Korean-specific features

## 📄 License

MIT License - See LICENSE file for details.