-- ==============================================================================
-- COLLABPULSE ENTERPRISE PLATFORM - POSTGRESQL 16+ INDEXES & CONSTRAINTS
-- Script: 03_indexes_and_constraints.sql
-- Optimizations for high concurrency, real-time messaging, and multi-tenancy
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TENANTS & USERS INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON tenants(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_tenant_status ON users(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_tenant_last_seen ON users(tenant_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_trgm_search ON users USING GIN ((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops);

-- ------------------------------------------------------------------------------
-- 2. AUTHENTICATION & SESSIONS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup ON user_sessions(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_lookup ON refresh_tokens(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ------------------------------------------------------------------------------
-- 3. WORKSPACES & INVITATIONS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant ON workspaces(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email, expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token_hash);

-- ------------------------------------------------------------------------------
-- 4. CHANNELS & CONVERSATIONS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_channels_workspace ON channels(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_channels_trgm_name ON channels USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);

-- ------------------------------------------------------------------------------
-- 5. MESSAGES (High Volume / Realtime Chat Optimizations)
-- ------------------------------------------------------------------------------
-- Channel messages query optimization
CREATE INDEX IF NOT EXISTS idx_messages_channel_timeline
    ON messages(tenant_id, channel_id, created_at DESC)
    WHERE channel_id IS NOT NULL AND deleted_at IS NULL;

-- Direct & Group conversation messages query optimization
CREATE INDEX IF NOT EXISTS idx_messages_conversation_timeline
    ON messages(tenant_id, conversation_id, created_at DESC)
    WHERE conversation_id IS NOT NULL AND deleted_at IS NULL;

-- Thread replies lookup
CREATE INDEX IF NOT EXISTS idx_messages_parent_thread
    ON messages(parent_message_id, created_at ASC)
    WHERE parent_message_id IS NOT NULL AND deleted_at IS NULL;

-- Sender history
CREATE INDEX IF NOT EXISTS idx_messages_sender
    ON messages(sender_id, created_at DESC);

-- FULL TEXT SEARCH (GIN with unaccent for high-speed multi-lingual search)
CREATE INDEX IF NOT EXISTS idx_messages_fts
    ON messages USING GIN (to_tsvector('simple', unaccent(content)));

-- Reactions, reads and pins
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_pins_channel ON message_pins(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_pins_conversation ON message_pins(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);

-- ------------------------------------------------------------------------------
-- 6. FILES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_files_tenant_timeline ON files(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);

-- ------------------------------------------------------------------------------
-- 7. NOTIFICATIONS & PREFERENCES
-- ------------------------------------------------------------------------------
-- Recommended composite index for user inbox feeds
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, is_read, created_at DESC);

-- ------------------------------------------------------------------------------
-- 8. TASKS & COMMENTS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assigned_status ON tasks(tenant_id, assigned_to, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status ON tasks(workspace_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(tenant_id, due_date) WHERE due_date IS NOT NULL AND status != 'completed';
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);

-- ------------------------------------------------------------------------------
-- 9. CALENDAR & MEETINGS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events(tenant_id, workspace_id, start_at, end_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_status_dates ON meetings(tenant_id, status, start_at);
CREATE INDEX IF NOT EXISTS idx_meetings_code ON meetings(meeting_code);

-- ------------------------------------------------------------------------------
-- 10. AUDIT LOGS (Compliance & Security Queries)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_timeline ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request ON audit_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin ON audit_logs USING GIN (metadata);

-- ------------------------------------------------------------------------------
-- 11. BILLING & INTEGRATIONS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_due ON invoices(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_webhooks_workspace ON webhooks(workspace_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_lookup ON api_keys(key_prefix, key_hash) WHERE revoked_at IS NULL;
