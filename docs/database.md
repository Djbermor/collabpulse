# Especificación de Base de Datos y Persistencia

## 1. Motor de Base de Datos
- **Motor:** PostgreSQL 18.4 (Google Cloud SQL)
- **Extensiones requeridas:** `uuid-ossp`, `pgcrypto`, `pg_trgm`, `unaccent`
- **Aislamiento:** Row Level Security (RLS) habilitado en todas las tablas sensibles al inquilino (`tenant_id`).

## 2. Esquemas de Datos
1. `users` (id, email, password_hash, full_name, avatar_url, status, created_at, updated_at)
2. `workspaces` (id, name, slug, logo_url, plan, owner_id, created_at)
3. `workspace_members` (workspace_id, user_id, role, joined_at)
4. `channels` (id, workspace_id, name, topic, is_private, created_by, created_at)
5. `channel_members` (channel_id, user_id, joined_at, role)
6. `messages` (id, workspace_id, channel_id, conversation_id, sender_id, content, type, is_edited, parent_message_id, created_at, updated_at, deleted_at)
7. `message_reactions` (id, message_id, user_id, emoji_code, created_at)
8. `tasks` (id, workspace_id, title, description, priority, status, due_date, assignee_id, creator_id, created_at, updated_at)
9. `calendar_events` (id, workspace_id, title, description, start_time, end_time, location, organizer_id, created_at)
10. `meetings` (id, workspace_id, title, room_name, provider, status, created_at)
11. `files` (id, workspace_id, original_name, storage_path, mime_type, size_bytes, uploader_id, created_at)
12. `notifications` (id, recipient_id, type, title, content, is_read, action_url, created_at)

## 3. Índices de Alto Rendimiento
- Índices B-Tree en llaves foráneas (`workspace_id`, `channel_id`, `sender_id`, `assignee_id`).
- Índices compuestos `(channel_id, created_at DESC)` para paginación de mensajes a ultra-baja latencia.
- Índices GIN sobre `to_tsvector('spanish', content)` para búsqueda full-text.
