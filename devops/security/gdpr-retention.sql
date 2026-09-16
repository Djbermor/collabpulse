-- =============================================================================
-- CollabPulse - GDPR Compliance & Automated Data Retention Policy
-- =============================================================================

-- 1. Hard Delete Soft-Deleted Messages older than 90 days (Section 65 & 67)
DELETE FROM messages
WHERE is_deleted = TRUE
  AND deleted_at < NOW() - INTERVAL '90 days';

-- 2. Prune Temporary File Records older than 14 days
DELETE FROM files
WHERE is_temporary = TRUE
  AND created_at < NOW() - INTERVAL '14 days';

-- 3. Archive/Prune Audit Logs older than 365 days
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '365 days';

-- 4. Invalidate Expired User Sessions
DELETE FROM user_sessions
WHERE expires_at < NOW()
   OR (is_revoked = TRUE AND revoked_at < NOW() - INTERVAL '30 days');

-- 5. Stored Procedure for GDPR "Right to be Forgotten" (Article 17)
CREATE OR REPLACE FUNCTION gdpr_erase_user_data(target_user_id VARCHAR(50))
RETURNS VOID AS $$
BEGIN
    -- Anonymize user profile details
    UPDATE users
    SET full_name = 'Deleted User',
        email = CONCAT('anonymized_', target_user_id, '@collabpulse.internal'),
        avatar_url = NULL,
        is_active = FALSE,
        status = 'offline',
        status_text = NULL
    WHERE id = target_user_id;

    -- Erase active sessions
    DELETE FROM user_sessions WHERE user_id = target_user_id;

    -- Erase notification queue
    DELETE FROM notifications WHERE user_id = target_user_id;

    -- Redact direct messages authored by user
    UPDATE messages
    SET content = '[This message was removed under GDPR privacy erasure policy]'
    WHERE sender_id = target_user_id;

    -- Audit log recording the GDPR execution (without personal details)
    INSERT INTO audit_logs (id, workspace_id, actor_id, action, resource, details, created_at)
    VALUES (
        gen_random_uuid()::text,
        'system',
        'system-privacy-worker',
        'GDPR_ERASE_COMPLETED',
        'User',
        CONCAT('User ID: ', target_user_id, ' was anonymized per legal request.'),
        NOW()
    );
END;
$$ LANGUAGE plpgsql;
