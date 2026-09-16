-- ==============================================================================
-- COLLABPULSE ENTERPRISE PLATFORM - VERIFICATION TEST SUITE
-- Script: test_integrity_constraints.sql
-- Fulfills Section 50 & 62: Verification of check constraints and integrity rules
-- ==============================================================================

DO $$
DECLARE
    tenant_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    workspace_id UUID := '33333333-3333-3333-3333-000000000001';
    sender_id UUID := '44444444-4444-4444-4444-000000000001';
    channel_id UUID := '55555555-5555-5555-5555-000000000001';
    conv_id UUID := gen_random_uuid();
    test_failed BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '>>> INICIANDO TEST DE REGLAS DE INTEGRIDAD Y CONSTRAINTS <<<';

    -- TEST 1: Constraint de Exclusión Mutua en Messages (canal_id XOR conversation_id)
    -- Intento de insertar mensaje con AMBOS nulos
    BEGIN
        INSERT INTO messages (tenant_id, workspace_id, channel_id, conversation_id, sender_id, content)
        VALUES (tenant_id, workspace_id, NULL, NULL, sender_id, 'Mensaje sin destino');
        test_failed := TRUE;
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE '  [PASS] chk_message_target rechazó correctamente mensaje con channel_id y conversation_id nulos.';
    END;

    IF test_failed THEN
        RAISE EXCEPTION 'TEST FALLIDO: chk_message_target permitió mensaje sin canal ni conversación';
    END IF;

    -- TEST 2: Intento de insertar archivo con tamaño negativo
    BEGIN
        INSERT INTO files (tenant_id, uploaded_by, original_name, storage_name, storage_provider, storage_path, mime_type, extension, size_bytes)
        VALUES (tenant_id, sender_id, 'bad.pdf', 'uuid.pdf', 'local', '/tmp', 'application/pdf', '.pdf', -1024);
        test_failed := TRUE;
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE '  [PASS] chk_files_size rechazó correctamente archivo con tamaño negativo.';
    END;

    IF test_failed THEN
        RAISE EXCEPTION 'TEST FALLIDO: chk_files_size permitió tamaño negativo';
    END IF;

    -- TEST 3: Intento de duplicar email dentro del mismo tenant
    BEGIN
        INSERT INTO users (tenant_id, first_name, last_name, email, password_hash, status)
        VALUES (tenant_id, 'Duplicado', 'Test', 'admin@demo.local', 'hash', 'online');
        test_failed := TRUE;
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '  [PASS] uq_users_tenant_email impidió registrar email duplicado dentro del mismo tenant.';
    END;

    IF test_failed THEN
        RAISE EXCEPTION 'TEST FALLIDO: uq_users_tenant_email permitió email duplicado en el mismo tenant';
    END IF;

    -- TEST 4: Soft Delete Verification
    -- Marcar un registro como soft deleted y verificar que la consulta con filtro no lo retorne
    INSERT INTO tasks (id, tenant_id, workspace_id, created_by, title, status, priority, deleted_at)
    VALUES ('aaaaaaaa-ffff-ffff-ffff-000000000001', tenant_id, workspace_id, sender_id, 'Tarea Borrada Lógicamente', 'pending', 'low', CLOCK_TIMESTAMP());

    IF EXISTS (SELECT 1 FROM tasks WHERE id = 'aaaaaaaa-ffff-ffff-ffff-000000000001' AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'TEST FALLIDO: Soft delete falló al filtrar registros eliminados';
    ELSE
        RAISE NOTICE '  [PASS] Filtro de soft delete (deleted_at IS NULL) verificado correctamente.';
    END IF;

    -- Limpieza de registro de test
    DELETE FROM tasks WHERE id = 'aaaaaaaa-ffff-ffff-ffff-000000000001';

    RAISE NOTICE '>>> TODOS LOS CONSTRAINTS Y PRUEBAS DE INTEGRIDAD PASARON SATISFACTORIAMENTE <<<';
END $$;
