-- Database setup for Korean language support and Discord optimization
-- PostgreSQL 14+ with extensions for full-text search and performance

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Set Korean locale support
SET lc_collate = 'ko_KR.UTF-8';
SET lc_ctype = 'ko_KR.UTF-8';

-- Custom stored procedures for Discord bot optimization

-- Function: Update user statistics after submission
CREATE OR REPLACE FUNCTION update_user_stats_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user stats when submission is created or feedback is added
    WITH user_submission_stats AS (
        SELECT 
            s.user_id,
            COUNT(*) as total_submissions,
            COUNT(f.id) as completed_assignments,
            AVG(CASE 
                WHEN f.ai_score IS NOT NULL AND f.ai_score::jsonb ? 'overall' 
                THEN (f.ai_score->>'overall')::float 
                ELSE NULL 
            END) as average_score,
            MAX(s.submitted_at) as last_submission_at,
            MODE() WITHIN GROUP (ORDER BY a.category) FILTER (WHERE a.category IS NOT NULL) as best_category
        FROM submissions s
        LEFT JOIN feedbacks f ON s.id = f.submission_id
        LEFT JOIN assignments a ON s.assignment_code = a.assignment_code
        WHERE s.user_id = COALESCE(NEW.user_id, OLD.user_id)
        GROUP BY s.user_id
    )
    INSERT INTO user_stats (
        user_id, 
        total_submissions, 
        completed_assignments, 
        average_score, 
        last_submission_at, 
        best_category,
        updated_at
    )
    SELECT 
        user_id,
        total_submissions,
        completed_assignments,
        average_score,
        last_submission_at,
        best_category,
        NOW()
    FROM user_submission_stats
    ON CONFLICT (user_id) DO UPDATE SET
        total_submissions = EXCLUDED.total_submissions,
        completed_assignments = EXCLUDED.completed_assignments,
        average_score = EXCLUDED.average_score,
        last_submission_at = EXCLUDED.last_submission_at,
        best_category = EXCLUDED.best_category,
        updated_at = NOW();

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function: Update assignment statistics
CREATE OR REPLACE FUNCTION update_assignment_stats_trigger()
RETURNS TRIGGER AS $$
BEGIN
    WITH assignment_submission_stats AS (
        SELECT 
            s.assignment_code,
            COUNT(*) as total_submissions,
            AVG(CASE 
                WHEN f.ai_score IS NOT NULL AND f.ai_score::jsonb ? 'overall' 
                THEN (f.ai_score->>'overall')::float 
                ELSE NULL 
            END) as average_score,
            AVG(f.processing_time) as average_processing_time,
            (COUNT(f.id)::float / NULLIF(COUNT(*), 0)) * 100 as completion_rate
        FROM submissions s
        LEFT JOIN feedbacks f ON s.id = f.submission_id
        WHERE s.assignment_code = COALESCE(NEW.assignment_code, OLD.assignment_code)
        GROUP BY s.assignment_code
    )
    INSERT INTO assignment_stats (
        assignment_code, 
        total_submissions, 
        average_score, 
        average_processing_time,
        completion_rate,
        updated_at
    )
    SELECT 
        assignment_code,
        total_submissions,
        average_score,
        average_processing_time::integer,
        completion_rate,
        NOW()
    FROM assignment_submission_stats
    ON CONFLICT (assignment_code) DO UPDATE SET
        total_submissions = EXCLUDED.total_submissions,
        average_score = EXCLUDED.average_score,
        average_processing_time = EXCLUDED.average_processing_time,
        completion_rate = EXCLUDED.completion_rate,
        updated_at = NOW();

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function: Clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM system_cache 
    WHERE expires_at < NOW();
    
    -- Log cleanup operation
    INSERT INTO performance_logs (operation, execution_time, success, metadata, created_at)
    VALUES (
        'cache_cleanup', 
        0, 
        true, 
        jsonb_build_object('deleted_entries', ROW_COUNT),
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Generate assignment code with collision checking
CREATE OR REPLACE FUNCTION generate_unique_assignment_code()
RETURNS text AS $$
DECLARE
    chars text := '0123456789ABCDEFGHIJKLMNPQRSTUVWXYZ';
    code text := '';
    char_count integer := length(chars);
    i integer;
    attempts integer := 0;
    max_attempts integer := 100;
BEGIN
    LOOP
        code := '';
        -- Generate 6-character code
        FOR i IN 1..6 LOOP
            code := code || substr(chars, floor(random() * char_count)::integer + 1, 1);
        END LOOP;
        
        -- Check if code already exists
        IF NOT EXISTS (SELECT 1 FROM assignments WHERE assignment_code = code) THEN
            RETURN code;
        END IF;
        
        attempts := attempts + 1;
        IF attempts >= max_attempts THEN
            RAISE EXCEPTION 'Could not generate unique assignment code after % attempts', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function: Korean text search optimization
CREATE OR REPLACE FUNCTION normalize_korean_text(input_text text)
RETURNS text AS $$
BEGIN
    -- Normalize Korean text for better search performance
    RETURN lower(
        regexp_replace(
            regexp_replace(input_text, '[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]', '', 'g'),
            '\s+', ' ', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Calculate user streak days
CREATE OR REPLACE FUNCTION calculate_user_streak(user_uuid uuid)
RETURNS integer AS $$
DECLARE
    streak_days integer := 0;
    current_date date := CURRENT_DATE;
    submission_dates date[];
    i integer;
BEGIN
    -- Get unique submission dates for user, ordered desc
    SELECT array_agg(submitted_at::date ORDER BY submitted_at::date DESC)
    INTO submission_dates
    FROM (
        SELECT DISTINCT submitted_at::date
        FROM submissions
        WHERE user_id = user_uuid
        ORDER BY submitted_at::date DESC
    ) unique_dates;
    
    -- Calculate consecutive days
    IF array_length(submission_dates, 1) IS NULL THEN
        RETURN 0;
    END IF;
    
    FOR i IN 1..array_length(submission_dates, 1) LOOP
        IF submission_dates[i] = current_date THEN
            streak_days := streak_days + 1;
            current_date := current_date - INTERVAL '1 day';
        ELSE
            EXIT;
        END IF;
    END LOOP;
    
    RETURN streak_days;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic statistics updates
DROP TRIGGER IF EXISTS trigger_update_user_stats_on_submission ON submissions;
CREATE TRIGGER trigger_update_user_stats_on_submission
    AFTER INSERT OR UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_stats_trigger();

DROP TRIGGER IF EXISTS trigger_update_user_stats_on_feedback ON feedbacks;
CREATE TRIGGER trigger_update_user_stats_on_feedback
    AFTER INSERT OR UPDATE ON feedbacks
    FOR EACH ROW
    EXECUTE FUNCTION update_user_stats_trigger();

DROP TRIGGER IF EXISTS trigger_update_assignment_stats_on_submission ON submissions;
CREATE TRIGGER trigger_update_assignment_stats_on_submission
    AFTER INSERT OR UPDATE OR DELETE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_assignment_stats_trigger();

DROP TRIGGER IF EXISTS trigger_update_assignment_stats_on_feedback ON feedbacks;
CREATE TRIGGER trigger_update_assignment_stats_on_feedback
    AFTER INSERT OR UPDATE OR DELETE ON feedbacks
    FOR EACH ROW
    EXECUTE FUNCTION update_assignment_stats_trigger();

-- Create indexes for optimal Discord bot performance
-- User indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_discord_lookup 
ON users (discord_id, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_korean_search 
ON users USING gin (normalize_korean_text(username));

-- Assignment indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_active_deadline 
ON assignments (is_active, deadline) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_korean_search 
ON assignments USING gin (normalize_korean_text(title || ' ' || description));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_category_active 
ON assignments (category, is_active) WHERE category IS NOT NULL AND is_active = true;

-- Submission indexes for Discord queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_user_assignment 
ON submissions (user_id, assignment_code, attempt_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_status_processing 
ON submissions (status, submitted_at) WHERE status IN ('PENDING', 'PROCESSING');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_assignment_stats 
ON submissions (assignment_code, status, submitted_at);

-- Feedback indexes for quick lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedbacks_submission_lookup 
ON feedbacks (submission_id, is_public) WHERE is_public = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedbacks_korean_search 
ON feedbacks USING gin (normalize_korean_text(ai_feedback));

-- Performance logging indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_logs_discord 
ON performance_logs (operation, created_at, success) 
WHERE operation LIKE 'discord_%';

-- Cache management indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_cache_expiry_cleanup 
ON system_cache (expires_at) WHERE expires_at < NOW();

-- Partial indexes for active records only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_only 
ON users (last_seen_at DESC) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_active_only 
ON assignments (deadline ASC) WHERE is_active = true;

-- Composite indexes for common Discord bot queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_submissions_recent 
ON submissions (user_id, submitted_at DESC, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_submissions_stats 
ON submissions (assignment_code, status, submitted_at DESC);

-- Text search indexes for Korean content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_fulltext 
ON assignments USING gin (
    to_tsvector('korean', title || ' ' || description || ' ' || requirements)
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedbacks_fulltext 
ON feedbacks USING gin (
    to_tsvector('korean', ai_feedback || COALESCE(' ' || manual_feedback, ''))
);

-- Statistics update optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stats_lookup 
ON user_stats (user_id, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_stats_lookup 
ON assignment_stats (assignment_code, updated_at DESC);

-- Create scheduled job for cache cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cache-cleanup', '0 2 * * *', 'SELECT clean_expired_cache();');

-- Grant permissions for application user
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Create views for common Discord bot queries
CREATE OR REPLACE VIEW discord_user_stats AS
SELECT 
    u.discord_id,
    u.username,
    u.display_name,
    u.last_seen_at,
    COALESCE(us.total_submissions, 0) as total_submissions,
    COALESCE(us.completed_assignments, 0) as completed_assignments,
    us.average_score,
    COALESCE(us.streak_days, 0) as streak_days,
    us.last_submission_at,
    us.best_category,
    u.created_at as joined_at
FROM users u
LEFT JOIN user_stats us ON u.id = us.user_id
WHERE u.is_active = true;

CREATE OR REPLACE VIEW discord_assignment_overview AS
SELECT 
    a.assignment_code,
    a.title,
    a.deadline,
    a.difficulty,
    a.category,
    a.is_active,
    COALESCE(ast.total_submissions, 0) as submission_count,
    ast.average_score,
    ast.completion_rate,
    CASE 
        WHEN a.deadline < NOW() THEN '마감됨'
        WHEN a.deadline < NOW() + INTERVAL '24 hours' THEN '마감임박'
        ELSE '진행중'
    END as status_kr
FROM assignments a
LEFT JOIN assignment_stats ast ON a.assignment_code = ast.assignment_code
ORDER BY a.deadline ASC;

CREATE OR REPLACE VIEW discord_recent_activity AS
SELECT 
    'submission'::text as activity_type,
    s.id as activity_id,
    u.discord_id,
    u.username,
    a.assignment_code,
    a.title as assignment_title,
    s.submitted_at as activity_time,
    s.status,
    NULL::text as feedback_preview
FROM submissions s
JOIN users u ON s.user_id = u.id
JOIN assignments a ON s.assignment_code = a.assignment_code
WHERE s.submitted_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
    'feedback'::text as activity_type,
    f.id as activity_id,
    u.discord_id,
    u.username,
    a.assignment_code,
    a.title as assignment_title,
    f.created_at as activity_time,
    s.status,
    LEFT(f.ai_feedback, 100) as feedback_preview
FROM feedbacks f
JOIN submissions s ON f.submission_id = s.id
JOIN users u ON s.user_id = u.id
JOIN assignments a ON s.assignment_code = a.assignment_code
WHERE f.created_at > NOW() - INTERVAL '7 days'

ORDER BY activity_time DESC
LIMIT 50;

-- Performance monitoring view
CREATE OR REPLACE VIEW discord_performance_stats AS
SELECT 
    operation,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE success = true) as successful_calls,
    ROUND(AVG(execution_time)) as avg_execution_time_ms,
    MAX(execution_time) as max_execution_time_ms,
    MIN(execution_time) as min_execution_time_ms,
    (COUNT(*) FILTER (WHERE success = true)::float / COUNT(*) * 100)::numeric(5,2) as success_rate_percent
FROM performance_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND operation LIKE 'discord_%'
GROUP BY operation
ORDER BY total_calls DESC;

COMMENT ON EXTENSION pg_trgm IS 'Korean text search optimization';
COMMENT ON FUNCTION update_user_stats_trigger() IS 'Auto-update user statistics on submission/feedback changes';
COMMENT ON FUNCTION update_assignment_stats_trigger() IS 'Auto-update assignment statistics on submission/feedback changes';
COMMENT ON FUNCTION clean_expired_cache() IS 'Remove expired cache entries for performance';
COMMENT ON FUNCTION generate_unique_assignment_code() IS 'Generate collision-free 6-character assignment codes';
COMMENT ON FUNCTION normalize_korean_text(text) IS 'Normalize Korean text for search optimization';
COMMENT ON FUNCTION calculate_user_streak(uuid) IS 'Calculate consecutive submission days for user gamification';

COMMENT ON VIEW discord_user_stats IS 'Optimized user statistics for Discord bot commands';
COMMENT ON VIEW discord_assignment_overview IS 'Assignment overview with Korean status indicators';
COMMENT ON VIEW discord_recent_activity IS 'Recent submissions and feedback activity feed';
COMMENT ON VIEW discord_performance_stats IS 'Real-time performance monitoring for Discord operations';