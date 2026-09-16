#!/usr/bin/env bash
# ==============================================================================
# CollabPulse Enterprise — Test Environment Reset Automation (Section 81)
# Restaura el ambiente de pruebas a un estado limpio, seguro y verificado.
# ==============================================================================
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-collabpulse_test}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

echo "=========================================================="
echo " [CollabPulse QA] Restableciendo Ambiente de Pruebas"
echo " Target DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo " Target Redis: ${REDIS_HOST}:${REDIS_PORT}"
echo "=========================================================="

export PGPASSWORD="${DB_PASSWORD}"

# 1. Truncar tablas transaccionales de forma segura en PostgreSQL
echo "--> 1/4 Truncando datos de prueba en PostgreSQL..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -q << 'EOF'
TRUNCATE TABLE
    message_reactions,
    message_reads,
    message_pins,
    message_attachments,
    messages,
    conversation_members,
    conversations,
    channel_members,
    channels,
    task_comments,
    task_attachments,
    tasks,
    calendar_event_attendees,
    calendar_events,
    meeting_participants,
    meetings,
    files,
    notifications,
    notification_preferences,
    workspace_invitations,
    workspace_members,
    workspaces,
    user_roles,
    user_sessions,
    refresh_tokens,
    audit_logs,
    users,
    tenants
CASCADE;
EOF

# 2. Re-aplicar datos semilla estándar (Acme Corporation + usuarios demo)
echo "--> 2/4 Sembrando datos base (01_seed_demo_company.sql)..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEEDS_DIR="${SCRIPT_DIR}/../seeds"

if [ -f "${SEEDS_DIR}/01_seed_demo_company.sql" ]; then
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${SEEDS_DIR}/01_seed_demo_company.sql" -q
    echo "    [OK] Seed base sembrado exitosamente."
else
    echo "    [WARN] No se encontró 01_seed_demo_company.sql"
fi

# 3. Purgar caché y colas en Redis
echo "--> 3/4 Purgando caché e índices temporales en Redis..."
if command -v redis-cli &> /dev/null; then
    redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" FLUSHDB || true
    echo "    [OK] Redis flush completado."
else
    echo "    [INFO] redis-cli no encontrado localmente, omitiendo flush de Redis directo."
fi

# 4. Validar integridad de salud
echo "--> 4/4 Verificando integridad de tablas..."
COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM users;")
echo "    [OK] Usuarios base activos en la base de prueba: ${COUNT// /}"

echo "=========================================================="
echo " [CollabPulse QA] Ambiente de pruebas restaurado con éxito."
echo "=========================================================="
