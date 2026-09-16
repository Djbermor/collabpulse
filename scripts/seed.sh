#!/usr/bin/env bash
# ==============================================================================
# CollabPulse Enterprise — Seed Data Runner (Section 56-57)
# Creates development users, workspace, channels, messages, tasks, events.
# ==============================================================================
set -euo pipefail

echo "=========================================================="
echo " [CollabPulse] Seeding Development and Demo Data"
echo "=========================================================="

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-collabpulse_dev}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
export PGPASSWORD="${DB_PASSWORD}"

if [ -f "database/seeds/01_seed_demo_company.sql" ]; then
    echo "--> Seeding Acme Corporation Demo Data (01_seed_demo_company.sql)..."
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "database/seeds/01_seed_demo_company.sql" -q || true
fi

if command -v dotnet &> /dev/null && [ -d "backend/src/DataGenerator" ]; then
    echo "--> Running .NET DataGenerator for high-scale synthetic seed..."
    dotnet run --project backend/src/DataGenerator/CollabPulse.DataGenerator.csproj -- \
        --workspaces 2 --users 25 --channels 8 --messages 150 || true
fi

echo "[✓] Seed completed successfully."
