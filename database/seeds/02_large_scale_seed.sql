-- ==============================================================================
-- COLLABPULSE ENTERPRISE PLATFORM - HIGH-VOLUME BENCHMARK SEED SCRIPT
-- Script: 02_large_scale_seed.sql
-- Fulfills Section 52 requirements (500 users, 50 channels, 50,000 messages)
-- ==============================================================================

DO $$
DECLARE
    v_tenant_id UUID := '11111111-1111-1111-1111-111111111111';
    v_workspace_id UUID := '22222222-2222-2222-2222-222222222222';
    v_owner_id UUID := '00000000-0000-0000-0000-000000000001';
    v_channel_id UUID;
    v_user_id UUID;
    v_message_id UUID;
    i INT;
    j INT;
    c INT;
BEGIN
    RAISE NOTICE 'Iniciando generación masiva de datos sintéticos para CollabPulse...';

    -- 1. Asegurar que existe el Tenant y Workspace base
    INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
    VALUES (v_tenant_id, 'Benchmark Enterprise Inc', 'benchmark-corp', 'active', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO workspaces (id, tenant_id, name, slug, owner_id, status, created_at, updated_at)
    VALUES (v_workspace_id, v_tenant_id, 'Benchmark Workspace', 'benchmark-ws', v_owner_id, 'active', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- 2. Generar 500 usuarios sintéticos en lotes
    RAISE NOTICE 'Generando 500 usuarios sintéticos...';
    FOR i IN 1..500 LOOP
        v_user_id := gen_random_uuid();
        INSERT INTO users (id, email, username, full_name, password_hash, status, is_email_verified, created_at, updated_at)
        VALUES (
            v_user_id,
            'loaduser_' || i || '@benchmark.internal',
            'loaduser_' || i,
            'Benchmark User ' || i,
            '$argon2id$v=19$m=65536,t=3,p=4$syntheticHashForLoadTestingOnly1234567890=',
            'active',
            true,
            NOW() - (i || ' minutes')::INTERVAL,
            NOW()
        )
        ON CONFLICT (email) DO NOTHING;

        -- Membresía en el workspace
        INSERT INTO workspace_members (id, workspace_id, user_id, role, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_workspace_id, v_user_id, 'member', 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- 3. Generar 50 canales
    RAISE NOTICE 'Generando 50 canales temáticos...';
    FOR c IN 1..50 LOOP
        v_channel_id := gen_random_uuid();
        INSERT INTO channels (id, workspace_id, name, slug, topic, is_private, created_by, status, created_at, updated_at)
        VALUES (
            v_channel_id,
            v_workspace_id,
            'perf-channel-' || c,
            'perf-channel-' || c,
            'Canal de pruebas de rendimiento y concurrencia ' || c,
            false,
            v_owner_id,
            'active',
            NOW() - (c || ' hours')::INTERVAL,
            NOW()
        );

        -- Membresía en el canal para el owner
        INSERT INTO channel_members (id, channel_id, user_id, role, created_at)
        VALUES (gen_random_uuid(), v_channel_id, v_owner_id, 'admin', NOW())
        ON CONFLICT DO NOTHING;

        -- 4. Generar 1,000 mensajes por canal (Total: 50,000 mensajes)
        INSERT INTO messages (id, channel_id, user_id, content, type, status, is_edited, reply_count, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            v_channel_id,
            v_owner_id,
            'Benchmark message #' || m || ' en ' || 'perf-channel-' || c || ' con contenido sintético y palabras clave para validación de tsvector de búsqueda.',
            'text',
            'sent',
            false,
            0,
            NOW() - ((50000 - m) || ' seconds')::INTERVAL,
            NOW()
        FROM generate_series(1, 1000) AS m;

    END LOOP;

    RAISE NOTICE 'Generación masiva completada con éxito: 500 usuarios, 50 canales y 50,000 mensajes.';
END $$;
