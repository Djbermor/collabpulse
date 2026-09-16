#!/usr/bin/env bash
# ==============================================================================
# CollabPulse Enterprise — Database Reset Runner (Section 56)
# Drops, recreates, migrates and seeds the database completely.
# ==============================================================================
set -euo pipefail

echo "=========================================================="
echo " [CollabPulse] Resetting Development Database"
echo "=========================================================="

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-collabpulse_dev}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
export PGPASSWORD="${DB_PASSWORD}"

echo "--> Dropping and recreating database ${DB_NAME}..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE);" -q || true
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};" -q || true

echo "--> Applying initial schemas..."
if [ -d "database/schema" ]; then
    for f in database/schema/*.sql; do
        if [ -f "$f" ]; then
            echo "    Applying $f..."
            psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "$f" -q || true
        fi
    done
fi

echo "--> Seeding fresh baseline data..."
if [ -f "scripts/seed.sh" ]; then
    bash scripts/seed.sh
fi

echo "[✓] Database reset and initialization complete!"
