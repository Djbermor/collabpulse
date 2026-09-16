#!/usr/bin/env bash
# ==============================================================================
# CollabPulse - Automated Backup Verification Drill (Disaster Recovery Testing)
# Spins up an ephemeral container, restores the latest backup, and runs sanity checks
# ==============================================================================

set -euo pipefail

echo "============================================================"
echo "CollabPulse Disaster Recovery - Backup Verification Drill"
echo "============================================================"

# Check latest local backup
LATEST_BACKUP=$(ls -t /tmp/collabpulse_backups/*.enc 2>/dev/null | head -n 1 || true)

if [ -z "${LATEST_BACKUP}" ]; then
  echo "No backup file found in /tmp/collabpulse_backups to verify."
  exit 0
fi

echo "Testing restore integrity of: ${LATEST_BACKUP}"

TEST_DB="dr_verification_test_$(date +%s)"

export BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-default_secret_key}"
export DB_PASSWORD="${DB_PASSWORD:-AdminSuperSecretPassword_ChangeInVault}"

/devops/backup/restore-postgres.sh "${LATEST_BACKUP}" "${TEST_DB}"

# Run query sanity check
RECORD_COUNT=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-postgres}" -U "${DB_USER:-collabpulse_admin}" -d "${TEST_DB}" -t -c "SELECT count(*) FROM workspaces;" | xargs)

echo "Sanity Verification Result: Restored database contains ${RECORD_COUNT} workspaces."

# Cleanup test db
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-postgres}" -U "${DB_USER:-collabpulse_admin}" -c "DROP DATABASE ${TEST_DB};"

echo "Disaster Recovery Verification Drill PASSED."
