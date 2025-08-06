-- ================================================================
-- Assignment Management System Database Architecture
-- Optimized for Discord Bot Integration and Korean Language Support
-- ================================================================

-- Database Configuration for Korean Language Support
-- UTF8MB4 for full UTF-8 support including emojis used in Discord
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ================================================================
-- CORE TABLES
-- ================================================================

-- 1. Assignments Table (과제 테이블)
-- Primary table for storing assignment metadata with 6-character unique codes
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_code VARCHAR(6) NOT NULL UNIQUE COMMENT '6자리 고유번호 (예: A1B2C3)',
    title VARCHAR(255) NOT NULL COMMENT '과제 제목',
    description TEXT COMMENT '과제 설명 (마크다운)',
    requirements TEXT NOT NULL COMMENT '필수 요구사항',
    recommendations TEXT COMMENT '권장사항',
    reference_links JSON COMMENT '참고 링크 배열',
    deadline TIMESTAMP NOT NULL COMMENT '마감일',
    ai_prompt_template TEXT COMMENT '과제별 맞춤 AI 평가 프롬프트',
    evaluation_criteria JSON COMMENT '평가 기준 설정',
    is_active BOOLEAN DEFAULT TRUE COMMENT '활성 상태',
    created_by UUID COMMENT '생성자 관리자 ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Discord 최적화 인덱스
    INDEX idx_assignment_code (assignment_code),
    INDEX idx_active_assignments (is_active, deadline),
    INDEX idx_created_at (created_at DESC),
    
    -- Full-text search for Korean content
    FULLTEXT idx_title_desc (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='과제 정보 테이블 - Discord 봇 명령어 최적화';

-- 2. Users Table (사용자 테이블)
-- Discord user information with Korean name support
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id VARCHAR(20) NOT NULL UNIQUE COMMENT 'Discord 사용자 ID',
    discord_username VARCHAR(32) NOT NULL COMMENT 'Discord 사용자명',
    display_name VARCHAR(100) COMMENT '표시명 (한글 지원)',
    nickname VARCHAR(50) COMMENT '별명',
    is_active BOOLEAN DEFAULT TRUE COMMENT '활성 상태',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '가입일',
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '마지막 활동',
    timezone VARCHAR(50) DEFAULT 'Asia/Seoul' COMMENT '시간대',
    
    -- Discord 최적화 인덱스
    INDEX idx_discord_id (discord_id),
    INDEX idx_active_users (is_active, last_active_at),
    INDEX idx_username (discord_username),
    
    -- Korean name search
    FULLTEXT idx_display_name (display_name, nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='사용자 정보 테이블 - Discord 연동';

-- 3. Submissions Table (제출물 테이블)
-- Optimized for Discord command queries with caching considerations
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_number BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE COMMENT '제출 번호 (순차)',
    assignment_code VARCHAR(6) NOT NULL COMMENT '과제 고유번호',
    user_id UUID NOT NULL COMMENT '제출자 ID',
    discord_user_id VARCHAR(20) NOT NULL COMMENT 'Discord 사용자 ID (캐시용)',
    
    -- Submission content
    submission_type ENUM('blog', 'code', 'file') NOT NULL COMMENT '제출 타입',
    title VARCHAR(255) COMMENT '제출물 제목',
    content LONGTEXT COMMENT '제출물 내용 (크롤링/첨부파일)',
    url VARCHAR(1000) COMMENT '제출 URL (GitHub, 블로그 등)',
    file_attachments JSON COMMENT '첨부파일 정보 배열',
    
    -- AI feedback and scoring
    ai_feedback LONGTEXT COMMENT 'AI 피드백 (마크다운)',
    ai_score JSON COMMENT 'AI 점수 (구조화된 평가)',
    manual_feedback TEXT COMMENT '관리자 수동 피드백',
    manual_score INTEGER COMMENT '관리자 수동 점수',
    
    -- Status and metadata
    status ENUM('submitted', 'evaluated', 'reviewed', 'approved') DEFAULT 'submitted',
    is_late BOOLEAN DEFAULT FALSE COMMENT '지각 제출 여부',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    evaluated_at TIMESTAMP NULL COMMENT 'AI 평가 완료 시간',
    reviewed_at TIMESTAMP NULL COMMENT '관리자 검토 완료 시간',
    
    -- Foreign key constraints
    FOREIGN KEY fk_submission_assignment (assignment_code) 
        REFERENCES assignments(assignment_code) ON DELETE CASCADE,
    FOREIGN KEY fk_submission_user (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    
    -- Discord 명령어 최적화 인덱스
    INDEX idx_assignment_user (assignment_code, user_id) COMMENT '!내제출 최적화',
    INDEX idx_user_submissions (user_id, submitted_at DESC) COMMENT '!현황 최적화',
    INDEX idx_submission_number (submission_number) COMMENT '!피드백 최적화',
    INDEX idx_discord_user (discord_user_id, submitted_at DESC) COMMENT 'Discord ID 캐시',
    INDEX idx_assignment_status (assignment_code, status) COMMENT '관리자 현황 조회',
    INDEX idx_recent_submissions (submitted_at DESC) COMMENT '최근 제출물 조회',
    
    -- Korean content search
    FULLTEXT idx_content_search (title, content, ai_feedback)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='제출물 테이블 - Discord 명령어 고성능 처리';

-- 4. Feedback Cache Table (피드백 캐시 테이블)
-- Dedicated table for fast Discord feedback retrieval
CREATE TABLE feedback_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL UNIQUE,
    submission_number BIGINT UNSIGNED NOT NULL,
    discord_user_id VARCHAR(20) NOT NULL,
    assignment_code VARCHAR(6) NOT NULL,
    
    -- Cached formatted content for Discord
    discord_feedback_text TEXT NOT NULL COMMENT 'Discord 형식 피드백',
    discord_summary TEXT NOT NULL COMMENT 'Discord 요약 피드백',
    feedback_embed JSON COMMENT 'Discord Embed 형식 데이터',
    
    -- Metadata
    feedback_length INTEGER COMMENT '피드백 길이 (Discord 제한 체크)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY fk_feedback_submission (submission_id) 
        REFERENCES submissions(id) ON DELETE CASCADE,
    
    -- 초고속 피드백 조회 인덱스
    INDEX idx_submission_number (submission_number) COMMENT '!피드백 {번호} 최적화',
    INDEX idx_user_assignment (discord_user_id, assignment_code) COMMENT '사용자별 피드백 조회'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Discord 피드백 명령어 캐시';

-- 5. User Assignment Status (사용자 과제 현황 테이블)
-- Materialized view table for fast status queries
CREATE TABLE user_assignment_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    discord_user_id VARCHAR(20) NOT NULL,
    assignment_code VARCHAR(6) NOT NULL,
    
    -- Status information
    submission_status ENUM('not_submitted', 'submitted', 'late', 'reviewed') NOT NULL,
    submission_id UUID NULL COMMENT '제출물 ID (제출한 경우)',
    submission_number BIGINT UNSIGNED NULL COMMENT '제출 번호',
    submitted_at TIMESTAMP NULL,
    score INTEGER NULL COMMENT '최종 점수',
    
    -- Cache for Discord display
    status_emoji VARCHAR(10) COMMENT '상태 이모지',
    status_text VARCHAR(50) COMMENT '상태 텍스트 (한글)',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_user_assignment (user_id, assignment_code),
    
    FOREIGN KEY fk_status_user (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY fk_status_assignment (assignment_code) 
        REFERENCES assignments(assignment_code) ON DELETE CASCADE,
    
    -- Discord 현황 명령어 최적화
    INDEX idx_user_status (discord_user_id, assignment_code) COMMENT '!내제출 최적화',
    INDEX idx_user_all_status (discord_user_id, updated_at DESC) COMMENT '!현황 최적화',
    INDEX idx_assignment_stats (assignment_code, submission_status) COMMENT '과제별 통계'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='사용자별 과제 현황 캐시 테이블';

-- ================================================================
-- SUPPORTING TABLES
-- ================================================================

-- 6. Discord Command Logs (Discord 명령어 로그)
-- For analytics and performance monitoring
CREATE TABLE discord_command_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_user_id VARCHAR(20) NOT NULL,
    command_name VARCHAR(50) NOT NULL,
    command_args TEXT,
    execution_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    response_length INTEGER,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Performance monitoring indexes
    INDEX idx_command_performance (command_name, executed_at DESC),
    INDEX idx_user_commands (discord_user_id, executed_at DESC),
    INDEX idx_execution_time (execution_time_ms DESC),
    INDEX idx_errors (success, executed_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Discord 명령어 실행 로그';

-- 7. AI Processing Queue (AI 처리 대기열)
-- For managing AI evaluation workload
CREATE TABLE ai_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL,
    assignment_code VARCHAR(6) NOT NULL,
    priority INTEGER DEFAULT 0 COMMENT '우선순위 (높을수록 우선)',
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_log TEXT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY fk_queue_submission (submission_id) 
        REFERENCES submissions(id) ON DELETE CASCADE,
    
    -- AI 처리 최적화
    INDEX idx_queue_status (status, priority DESC, created_at ASC),
    INDEX idx_submission_queue (submission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='AI 평가 처리 대기열';

-- 8. System Settings (시스템 설정)
-- Configuration table for dynamic settings
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type ENUM('string', 'integer', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE COMMENT '사용자에게 공개 여부',
    updated_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_setting_key (setting_key),
    INDEX idx_public_settings (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='시스템 설정 테이블';

-- ================================================================
-- DISCORD COMMAND OPTIMIZATION VIEWS
-- ================================================================

-- View for !과제리스트 command
CREATE VIEW v_assignment_list AS
SELECT 
    a.assignment_code,
    a.title,
    a.deadline,
    a.is_active,
    COUNT(s.id) as total_submissions,
    COUNT(CASE WHEN s.status IN ('evaluated', 'reviewed', 'approved') THEN 1 END) as completed_submissions
FROM assignments a
LEFT JOIN submissions s ON a.assignment_code = s.assignment_code
WHERE a.is_active = TRUE
GROUP BY a.id, a.assignment_code, a.title, a.deadline, a.is_active
ORDER BY a.created_at DESC;

-- View for !현황 command optimization
CREATE VIEW v_user_status_summary AS
SELECT 
    u.discord_user_id,
    u.display_name,
    COUNT(uas.assignment_code) as total_assignments,
    COUNT(CASE WHEN uas.submission_status = 'submitted' THEN 1 END) as submitted_count,
    COUNT(CASE WHEN uas.submission_status = 'not_submitted' THEN 1 END) as not_submitted_count,
    COUNT(CASE WHEN uas.submission_status = 'late' THEN 1 END) as late_count,
    AVG(uas.score) as avg_score,
    MAX(uas.updated_at) as last_activity
FROM users u
LEFT JOIN user_assignment_status uas ON u.id = uas.user_id
WHERE u.is_active = TRUE
GROUP BY u.id, u.discord_user_id, u.display_name;

-- ================================================================
-- STORED PROCEDURES FOR DISCORD COMMANDS
-- ================================================================

DELIMITER //

-- Procedure for !공지 command
CREATE PROCEDURE GetAssignmentDetails(
    IN p_assignment_code VARCHAR(6),
    IN p_discord_user_id VARCHAR(20)
)
BEGIN
    DECLARE v_user_id UUID;
    
    -- Get user ID
    SELECT id INTO v_user_id 
    FROM users 
    WHERE discord_id = p_discord_user_id;
    
    -- Return assignment details with user's submission status
    SELECT 
        a.assignment_code,
        a.title,
        a.description,
        a.requirements,
        a.recommendations,
        a.reference_links,
        a.deadline,
        CASE 
            WHEN a.deadline < NOW() THEN '마감됨'
            WHEN TIMESTAMPDIFF(HOUR, NOW(), a.deadline) <= 24 THEN '마감 임박'
            ELSE '진행중'
        END as status,
        uas.submission_status,
        uas.submitted_at,
        uas.score,
        s.submission_number
    FROM assignments a
    LEFT JOIN user_assignment_status uas ON a.assignment_code = uas.assignment_code 
        AND uas.user_id = v_user_id
    LEFT JOIN submissions s ON uas.submission_id = s.id
    WHERE a.assignment_code = p_assignment_code AND a.is_active = TRUE;
END //

-- Procedure for !내제출 command
CREATE PROCEDURE GetUserSubmissionStatus(
    IN p_assignment_code VARCHAR(6),
    IN p_discord_user_id VARCHAR(20)
)
BEGIN
    SELECT 
        a.assignment_code,
        a.title,
        uas.submission_status,
        uas.status_emoji,
        uas.status_text,
        s.submission_number,
        s.title as submission_title,
        s.submitted_at,
        s.ai_score,
        s.manual_score,
        CASE 
            WHEN s.ai_feedback IS NOT NULL THEN TRUE 
            ELSE FALSE 
        END as has_feedback
    FROM assignments a
    LEFT JOIN users u ON u.discord_id = p_discord_user_id
    LEFT JOIN user_assignment_status uas ON a.assignment_code = uas.assignment_code 
        AND uas.user_id = u.id
    LEFT JOIN submissions s ON uas.submission_id = s.id
    WHERE a.assignment_code = p_assignment_code AND a.is_active = TRUE;
END //

-- Procedure for !피드백 command
CREATE PROCEDURE GetSubmissionFeedback(
    IN p_submission_number BIGINT,
    IN p_discord_user_id VARCHAR(20)
)
BEGIN
    SELECT 
        fc.discord_feedback_text,
        fc.discord_summary,
        fc.feedback_embed,
        s.title,
        s.submitted_at,
        a.title as assignment_title,
        a.assignment_code
    FROM feedback_cache fc
    JOIN submissions s ON fc.submission_id = s.id
    JOIN assignments a ON s.assignment_code = a.assignment_code
    WHERE fc.submission_number = p_submission_number 
    AND s.discord_user_id = p_discord_user_id;
END //

DELIMITER ;

-- ================================================================
-- TRIGGERS FOR CACHE MAINTENANCE
-- ================================================================

DELIMITER //

-- Trigger to update user_assignment_status when submission is created
CREATE TRIGGER tr_submission_insert 
AFTER INSERT ON submissions
FOR EACH ROW
BEGIN
    INSERT INTO user_assignment_status (
        user_id, discord_user_id, assignment_code, submission_status, 
        submission_id, submission_number, submitted_at, status_emoji, status_text
    ) VALUES (
        NEW.user_id, NEW.discord_user_id, NEW.assignment_code, 
        CASE WHEN NEW.is_late THEN 'late' ELSE 'submitted' END,
        NEW.id, NEW.submission_number, NEW.submitted_at,
        CASE WHEN NEW.is_late THEN '⏰' ELSE '✅' END,
        CASE WHEN NEW.is_late THEN '지각 제출' ELSE '제출 완료' END
    ) 
    ON DUPLICATE KEY UPDATE
        submission_status = CASE WHEN NEW.is_late THEN 'late' ELSE 'submitted' END,
        submission_id = NEW.id,
        submission_number = NEW.submission_number,
        submitted_at = NEW.submitted_at,
        status_emoji = CASE WHEN NEW.is_late THEN '⏰' ELSE '✅' END,
        status_text = CASE WHEN NEW.is_late THEN '지각 제출' ELSE '제출 완료' END,
        updated_at = CURRENT_TIMESTAMP;
END //

-- Trigger to create feedback cache when AI feedback is added
CREATE TRIGGER tr_ai_feedback_update
AFTER UPDATE ON submissions
FOR EACH ROW
BEGIN
    IF NEW.ai_feedback IS NOT NULL AND OLD.ai_feedback IS NULL THEN
        INSERT INTO feedback_cache (
            submission_id, submission_number, discord_user_id, assignment_code,
            discord_feedback_text, discord_summary, feedback_length
        ) VALUES (
            NEW.id, NEW.submission_number, NEW.discord_user_id, NEW.assignment_code,
            LEFT(NEW.ai_feedback, 1900), -- Discord 2000 character limit
            LEFT(NEW.ai_feedback, 300),   -- Summary for embeds
            CHAR_LENGTH(NEW.ai_feedback)
        );
        
        UPDATE user_assignment_status 
        SET submission_status = 'reviewed',
            status_emoji = '📝',
            status_text = '피드백 완료',
            score = JSON_UNQUOTE(JSON_EXTRACT(NEW.ai_score, '$.total_score')),
            updated_at = CURRENT_TIMESTAMP
        WHERE submission_id = NEW.id;
    END IF;
END //

DELIMITER ;

-- ================================================================
-- PERFORMANCE OPTIMIZATION SETTINGS
-- ================================================================

-- Query cache settings for frequently accessed data
SET GLOBAL query_cache_type = ON;
SET GLOBAL query_cache_size = 268435456; -- 256MB

-- InnoDB settings for high concurrency
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL innodb_log_file_size = 268435456; -- 256MB
SET GLOBAL innodb_flush_log_at_trx_commit = 2; -- Performance over durability

-- Connection settings for Discord bot
SET GLOBAL max_connections = 200;
SET GLOBAL connect_timeout = 10;
SET GLOBAL wait_timeout = 300;

-- ================================================================
-- INITIAL DATA SETUP
-- ================================================================

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('discord_command_rate_limit', '10', 'integer', 'Discord 명령어 사용자당 분당 제한', FALSE),
('ai_evaluation_timeout', '300', 'integer', 'AI 평가 타임아웃 (초)', FALSE),
('assignment_code_prefix', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 'string', '과제 코드 생성용 문자셋', FALSE),
('max_file_size_mb', '8', 'integer', 'Discord 파일 첨부 최대 크기 (MB)', TRUE),
('supported_file_extensions', '["py", "js", "jsx", "ts", "tsx", "html", "css", "scss", "json", "md"]', 'json', '지원하는 파일 확장자', TRUE),
('timezone', 'Asia/Seoul', 'string', '시스템 기본 시간대', TRUE);

-- Create indexes for common Discord queries
CREATE INDEX idx_assignments_active_deadline ON assignments (is_active, deadline ASC);
CREATE INDEX idx_submissions_recent ON submissions (submitted_at DESC) USING BTREE;
CREATE INDEX idx_users_active ON users (is_active, last_active_at DESC);

-- Create composite indexes for complex queries
CREATE INDEX idx_submission_lookup ON submissions (assignment_code, discord_user_id, submitted_at DESC);
CREATE INDEX idx_status_lookup ON user_assignment_status (discord_user_id, assignment_code, submission_status);

-- ================================================================
-- MAINTENANCE PROCEDURES
-- ================================================================

DELIMITER //

-- Procedure to clean old logs
CREATE PROCEDURE CleanOldLogs()
BEGIN
    -- Delete command logs older than 30 days
    DELETE FROM discord_command_logs 
    WHERE executed_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Delete completed AI processing queue items older than 7 days
    DELETE FROM ai_processing_queue 
    WHERE status = 'completed' AND completed_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
    
    -- Update user last_active_at
    UPDATE users u
    SET last_active_at = (
        SELECT MAX(executed_at) 
        FROM discord_command_logs dcl 
        WHERE dcl.discord_user_id = u.discord_id
    )
    WHERE u.last_active_at < DATE_SUB(NOW(), INTERVAL 1 DAY);
END //

-- Procedure to rebuild cache tables
CREATE PROCEDURE RebuildCaches()
BEGIN
    -- Rebuild user_assignment_status cache
    DELETE FROM user_assignment_status;
    
    INSERT INTO user_assignment_status (
        user_id, discord_user_id, assignment_code, submission_status,
        submission_id, submission_number, submitted_at, status_emoji, status_text, score
    )
    SELECT 
        u.id,
        u.discord_id,
        a.assignment_code,
        CASE 
            WHEN s.id IS NULL THEN 'not_submitted'
            WHEN s.is_late THEN 'late'
            WHEN s.ai_feedback IS NOT NULL THEN 'reviewed'
            ELSE 'submitted'
        END,
        s.id,
        s.submission_number,
        s.submitted_at,
        CASE 
            WHEN s.id IS NULL THEN '❌'
            WHEN s.is_late THEN '⏰'
            WHEN s.ai_feedback IS NOT NULL THEN '📝'
            ELSE '✅'
        END,
        CASE 
            WHEN s.id IS NULL THEN '미제출'
            WHEN s.is_late THEN '지각 제출'
            WHEN s.ai_feedback IS NOT NULL THEN '피드백 완료'
            ELSE '제출 완료'
        END,
        JSON_UNQUOTE(JSON_EXTRACT(s.ai_score, '$.total_score'))
    FROM users u
    CROSS JOIN assignments a
    LEFT JOIN submissions s ON a.assignment_code = s.assignment_code AND u.id = s.user_id
    WHERE u.is_active = TRUE AND a.is_active = TRUE;
    
    -- Rebuild feedback cache
    DELETE FROM feedback_cache;
    
    INSERT INTO feedback_cache (
        submission_id, submission_number, discord_user_id, assignment_code,
        discord_feedback_text, discord_summary, feedback_length
    )
    SELECT 
        s.id,
        s.submission_number,
        s.discord_user_id,
        s.assignment_code,
        LEFT(s.ai_feedback, 1900),
        LEFT(s.ai_feedback, 300),
        CHAR_LENGTH(s.ai_feedback)
    FROM submissions s
    WHERE s.ai_feedback IS NOT NULL;
END //

DELIMITER ;

-- ================================================================
-- MONITORING AND ANALYTICS VIEWS
-- ================================================================

-- Discord Command Performance Analytics
CREATE VIEW v_command_performance AS
SELECT 
    command_name,
    COUNT(*) as execution_count,
    AVG(execution_time_ms) as avg_execution_time,
    MAX(execution_time_ms) as max_execution_time,
    SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as error_count,
    (SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) / COUNT(*)) * 100 as error_rate
FROM discord_command_logs
WHERE executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY command_name
ORDER BY execution_count DESC;

-- Assignment Submission Statistics
CREATE VIEW v_assignment_stats AS
SELECT 
    a.assignment_code,
    a.title,
    a.deadline,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(s.id) as total_submissions,
    COUNT(CASE WHEN s.is_late = FALSE THEN 1 END) as on_time_submissions,
    COUNT(CASE WHEN s.is_late = TRUE THEN 1 END) as late_submissions,
    COUNT(CASE WHEN s.ai_feedback IS NOT NULL THEN 1 END) as evaluated_submissions,
    (COUNT(s.id) / COUNT(DISTINCT u.id)) * 100 as submission_rate
FROM assignments a
CROSS JOIN users u
LEFT JOIN submissions s ON a.assignment_code = s.assignment_code AND u.id = s.user_id
WHERE a.is_active = TRUE AND u.is_active = TRUE
GROUP BY a.id, a.assignment_code, a.title, a.deadline
ORDER BY a.created_at DESC;

-- Real-time Active Users
CREATE VIEW v_active_users AS
SELECT 
    u.discord_id,
    u.discord_username,
    u.display_name,
    u.last_active_at,
    COUNT(dcl.id) as commands_today,
    MAX(dcl.executed_at) as last_command_at
FROM users u
LEFT JOIN discord_command_logs dcl ON u.discord_id = dcl.discord_user_id 
    AND dcl.executed_at >= CURDATE()
WHERE u.is_active = TRUE
GROUP BY u.id, u.discord_id, u.discord_username, u.display_name, u.last_active_at
ORDER BY u.last_active_at DESC;

-- ================================================================
-- COMMENTS AND USAGE NOTES
-- ================================================================

/*
DISCORD COMMAND OPTIMIZATION STRATEGY:

1. !공지 {과제고유번호}
   - Primary index: assignments.assignment_code
   - Cached join with user_assignment_status
   - Single query execution via stored procedure

2. !제출글/!제출코드 {과제고유번호}
   - Validates assignment_code existence first
   - Auto-generates submission_number
   - Triggers update user_assignment_status cache

3. !피드백 {제출번호}
   - Direct lookup via feedback_cache.submission_number
   - Pre-formatted Discord text content
   - Sub-100ms response time target

4. !내제출 {과제고유번호}
   - Single query via user_assignment_status cache
   - Includes submission status, score, feedback availability

5. !현황
   - Materialized view v_user_status_summary
   - Aggregated statistics cached for performance

6. !과제리스트
   - View v_assignment_list with submission counts
   - Ordered by creation date (latest first)

KOREAN LANGUAGE SUPPORT:
- UTF8MB4 character set for full Unicode support
- Fulltext indexes for Korean content search
- Proper collation for Korean sorting
- Emoji support for Discord status indicators

CACHING STRATEGY:
- user_assignment_status: Materialized cache for status queries
- feedback_cache: Pre-formatted Discord messages
- Views for complex aggregations
- Trigger-based cache invalidation

PERFORMANCE CONSIDERATIONS:
- Compound indexes for multi-column Discord queries
- Partitioning considered for large-scale deployments
- Connection pooling recommended for Discord bot
- Query cache enabled for repeated lookups

SCALABILITY FEATURES:
- UUID primary keys for distributed scaling
- Horizontal partitioning ready (by assignment_code)
- Async AI processing queue
- Rate limiting support built-in

MONITORING AND MAINTENANCE:
- Command execution logging with performance metrics
- Automated cache rebuilding procedures
- Old data cleanup routines
- Real-time performance analytics views
*/