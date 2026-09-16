-- =============================================================================
-- CollabPulse - PostgreSQL Routine Maintenance Script
-- Executed periodically via cron / Kubernetes CronJob
-- =============================================================================

-- 1. Refresh database table statistics for the query planner
ANALYZE VERBOSE messages;
ANALYZE VERBOSE message_reactions;
ANALYZE VERBOSE channels;
ANALYZE VERBOSE workspace_members;
ANALYZE VERBOSE tasks;
ANALYZE VERBOSE audit_logs;

-- 2. Clean dead tuples from high-write tables
VACUUM (ANALYZE) messages;
VACUUM (ANALYZE) notifications;
VACUUM (ANALYZE) user_sessions;

-- 3. Check for index bloat or invalid indexes
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS number_of_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- 4. Audit active connection distribution
SELECT
    datname,
    usename,
    state,
    count(*) AS active_connections
FROM pg_stat_activity
GROUP BY datname, usename, state
ORDER BY active_connections DESC;
