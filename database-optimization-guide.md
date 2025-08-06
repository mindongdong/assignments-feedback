# Database Architecture Optimization Guide

## Discord Bot Performance Strategy

### Core Performance Requirements
- **Sub-100ms Response Time**: All Discord commands must respond within 100ms
- **High Concurrency**: Support 50+ simultaneous Discord users
- **Korean Language Support**: Full UTF-8 with emoji support
- **Cache-First Architecture**: Minimize database queries through intelligent caching

## Index Strategy by Discord Command

### 1. !공지 {과제고유번호} Command Optimization
```sql
-- Primary lookup index
INDEX idx_assignment_code (assignment_code)

-- Status cache join optimization  
INDEX idx_user_assignment (discord_user_id, assignment_code)

-- Performance: Single index seek + cached join = <10ms
```

**Query Pattern**: Direct assignment lookup with user status
**Expected Load**: Medium frequency, high cache hit rate
**Optimization**: Stored procedure `GetAssignmentDetails()` for single-query execution

### 2. !제출 Command Series Optimization
```sql
-- Submission validation
INDEX idx_assignment_code (assignment_code)

-- Auto-increment optimization
INDEX idx_submission_number (submission_number)

-- User submission history
INDEX idx_user_submissions (user_id, submitted_at DESC)
```

**Query Pattern**: Validation → Insert → Cache update
**Expected Load**: High frequency during assignment periods
**Optimization**: Trigger-based cache updates, batch processing for file uploads

### 3. !피드백 {제출번호} Command Optimization
```sql
-- Ultra-fast feedback lookup
CREATE TABLE feedback_cache (
    submission_number BIGINT UNSIGNED NOT NULL,
    discord_feedback_text TEXT NOT NULL,
    INDEX idx_submission_number (submission_number)
);
```

**Query Pattern**: Single index seek on submission_number
**Expected Load**: Very high frequency
**Optimization**: Pre-formatted Discord messages, sub-10ms response target

### 4. !내제출 {과제고유번호} Command Optimization
```sql
-- Materialized status cache
CREATE TABLE user_assignment_status (
    discord_user_id VARCHAR(20) NOT NULL,
    assignment_code VARCHAR(6) NOT NULL,
    INDEX idx_user_assignment (discord_user_id, assignment_code)
);
```

**Query Pattern**: Direct cache lookup
**Expected Load**: High frequency
**Optimization**: Real-time cache updates via triggers

### 5. !현황 Command Optimization
```sql
-- Aggregated user statistics view
CREATE VIEW v_user_status_summary AS
SELECT discord_user_id, total_assignments, submitted_count, avg_score
FROM user_assignment_status
GROUP BY discord_user_id;
```

**Query Pattern**: Aggregation from cache table
**Expected Load**: Medium frequency
**Optimization**: Materialized view with periodic refresh

### 6. !과제리스트 Command Optimization
```sql
-- Assignment list with submission counts
CREATE VIEW v_assignment_list AS
SELECT assignment_code, title, deadline, total_submissions
FROM assignments a
LEFT JOIN submissions s ON a.assignment_code = s.assignment_code
ORDER BY created_at DESC;
```

**Query Pattern**: List with counts
**Expected Load**: Low-medium frequency
**Optimization**: View with submission count caching

## Caching Architecture

### Three-Layer Caching Strategy

#### Layer 1: Database Query Cache
```sql
-- MySQL Query Cache for repeated queries
SET GLOBAL query_cache_type = ON;
SET GLOBAL query_cache_size = 268435456; -- 256MB
```
- **Purpose**: Cache identical SQL queries
- **Benefit**: 90%+ cache hit rate for read queries
- **Invalidation**: Automatic on table updates

#### Layer 2: Application-Level Cache (Redis Recommended)
```javascript
// Discord command response caching
const cacheKeys = {
    assignment: `assignment:${assignmentCode}`,
    userStatus: `user:${discordUserId}:status`,
    feedback: `feedback:${submissionNumber}`,
    assignmentList: `assignments:list:${page}`
};

// Cache TTL settings
const cacheTTL = {
    assignment: 3600,    // 1 hour - rarely changes
    userStatus: 300,     // 5 minutes - updates frequently  
    feedback: 86400,     // 24 hours - immutable once created
    assignmentList: 600  // 10 minutes - moderate changes
};
```

#### Layer 3: Database Materialized Caches
- **user_assignment_status**: Real-time status cache
- **feedback_cache**: Pre-formatted Discord messages
- **Views**: Aggregated statistics

### Cache Invalidation Strategy

#### Trigger-Based Invalidation
```sql
-- Automatic cache updates on data changes
CREATE TRIGGER tr_submission_insert 
AFTER INSERT ON submissions
FOR EACH ROW
BEGIN
    -- Update status cache
    INSERT INTO user_assignment_status (...) 
    ON DUPLICATE KEY UPDATE ...;
    
    -- Invalidate Redis cache
    -- (Handled by application layer)
END
```

#### Application-Level Invalidation
```javascript
// Smart cache invalidation on Discord commands
async function invalidateUserCache(discordUserId, assignmentCode) {
    await redis.del(`user:${discordUserId}:status`);
    await redis.del(`assignment:${assignmentCode}:stats`);
    await redis.del('assignments:list:*'); // Pattern deletion
}
```

## Korean Language Support

### Character Set Configuration
```sql
-- Full UTF-8 support including Korean and emojis
CREATE DATABASE assignment_system 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- All tables use UTF8MB4
DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### Korean Text Indexing
```sql
-- Full-text search for Korean content
ALTER TABLE assignments 
ADD FULLTEXT idx_korean_content (title, description);

-- Korean name search optimization
ALTER TABLE users 
ADD FULLTEXT idx_korean_names (display_name, nickname);
```

### Discord Emoji Integration
```sql
-- Emoji status indicators
status_emoji VARCHAR(10) COMMENT '상태 이모지',

-- Common Korean status emojis
'✅' -- 제출 완료
'❌' -- 미제출  
'⏰' -- 지각 제출
'📝' -- 피드백 완료
'🚨' -- 마감 임박
```

## Concurrent User Optimization

### Connection Pool Configuration
```sql
-- MySQL connection settings for Discord bot
SET GLOBAL max_connections = 200;
SET GLOBAL connect_timeout = 10;
SET GLOBAL wait_timeout = 300;
SET GLOBAL interactive_timeout = 300;
```

### Database Lock Optimization
```sql
-- InnoDB settings for high concurrency
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL innodb_lock_wait_timeout = 5;
SET GLOBAL innodb_deadlock_detect = ON;
```

### Query Optimization for Concurrency
```sql
-- Use covering indexes to avoid table locks
CREATE INDEX idx_submission_covering 
ON submissions (assignment_code, discord_user_id, status, submitted_at);

-- Partition large tables by assignment_code if needed
-- ALTER TABLE submissions 
-- PARTITION BY HASH(CRC32(assignment_code)) PARTITIONS 10;
```

## Migration Strategy

### Phase 1: Initial Schema Creation
```sql
-- Create core tables with optimized indexes
SOURCE database-architecture.sql;

-- Verify Korean character support
INSERT INTO users (discord_id, display_name) 
VALUES ('test', '한글테스트');
```

### Phase 2: Data Population
```sql
-- Generate sample assignment codes
CALL GenerateAssignmentCodes(100); -- Generates 100 unique codes

-- Import existing user data
LOAD DATA INFILE 'users.csv' 
INTO TABLE users 
CHARACTER SET utf8mb4;
```

### Phase 3: Performance Validation
```sql
-- Test Discord command performance
CALL TestCommandPerformance();

-- Validate index usage
EXPLAIN SELECT * FROM assignments WHERE assignment_code = 'A1B2C3';
-- Should show: type=const, key=idx_assignment_code
```

### Phase 4: Production Cutover
```sql
-- Enable production optimizations
SET GLOBAL query_cache_type = ON;
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 0.1; -- Log queries >100ms
```

## Monitoring and Maintenance

### Performance Monitoring Queries
```sql
-- Discord command performance analysis
SELECT command_name, AVG(execution_time_ms), COUNT(*)
FROM discord_command_logs 
WHERE executed_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
GROUP BY command_name
ORDER BY AVG(execution_time_ms) DESC;

-- Slow query identification
SELECT sql_text, exec_count, avg_timer_wait/1000000 as avg_ms
FROM performance_schema.events_statements_summary_by_digest
WHERE avg_timer_wait/1000000 > 100
ORDER BY avg_timer_wait DESC;
```

### Automated Maintenance
```sql
-- Daily maintenance procedure
CREATE EVENT ev_daily_maintenance
ON SCHEDULE EVERY 1 DAY
STARTS '2025-01-01 02:00:00'
DO CALL CleanOldLogs();

-- Weekly cache rebuild
CREATE EVENT ev_weekly_cache_rebuild  
ON SCHEDULE EVERY 1 WEEK
STARTS '2025-01-01 03:00:00'
DO CALL RebuildCaches();
```

### Index Maintenance
```sql
-- Weekly index optimization
OPTIMIZE TABLE assignments, users, submissions, user_assignment_status;

-- Monthly index usage analysis
SELECT table_name, index_name, cardinality, 
       (SELECT COUNT(*) FROM information_schema.statistics 
        WHERE table_name = s.table_name) as total_indexes
FROM information_schema.statistics s
WHERE table_schema = 'assignment_system'
ORDER BY cardinality DESC;
```

## Data Integrity Measures

### Foreign Key Relationships
```sql
-- Cascading deletes for data consistency
FOREIGN KEY fk_submission_assignment (assignment_code) 
    REFERENCES assignments(assignment_code) ON DELETE CASCADE;

-- Prevent orphaned records
FOREIGN KEY fk_submission_user (user_id) 
    REFERENCES users(id) ON DELETE CASCADE;
```

### Data Validation Constraints
```sql
-- Assignment code format validation
CHECK (assignment_code REGEXP '^[A-Z0-9]{6}$');

-- Discord ID format validation  
CHECK (discord_id REGEXP '^[0-9]{17,20}$');

-- Submission type validation
submission_type ENUM('blog', 'code', 'file') NOT NULL;
```

### Backup Strategy
```bash
# Daily incremental backups
mysqldump --single-transaction --routines --triggers \
  --databases assignment_system > backup_$(date +%Y%m%d).sql

# Point-in-time recovery setup
SET GLOBAL log_bin = ON;
SET GLOBAL binlog_format = ROW;
```

## Performance Benchmarks

### Target Performance Metrics
- **!공지**: <50ms response time
- **!제출**: <100ms processing time
- **!피드백**: <25ms response time (cached)
- **!현황**: <75ms aggregation time
- **!과제리스트**: <30ms list generation

### Load Testing Scenarios
```javascript
// Concurrent user simulation
const loadTest = {
    users: 50,
    commandsPerMinute: 30,
    testDuration: '10m',
    commands: ['!공지', '!내제출', '!현황', '!과제리스트']
};
```

### Expected Scaling Limits
- **Users**: 500+ concurrent Discord users
- **Assignments**: 1000+ active assignments
- **Submissions**: 10,000+ daily submissions
- **Database**: 10M+ total records

This architecture provides a robust foundation for the Discord assignment management system with optimized performance, Korean language support, and horizontal scaling capabilities.