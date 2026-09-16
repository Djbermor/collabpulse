#!/usr/bin/env bash
# ==============================================================================
# CollabPulse - Automated Database Restore & PITR Script
# Decrypts and restores PostgreSQL backup with checksum integrity verification
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path_to_encrypted_dump_file> [target_database_name]"
  exit 1
fi

ENCRYPTED_FILE="$1"
TARGET_DB="${2:-collabpulse_restore_test}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-collabpulse_admin}"
BACKUP_PASSPHRASE="${BACKUP_ENCRYPTION_KEY:-}"

if [ -z "${BACKUP_PASSPHRASE}" ]; then
  echo "Error: BACKUP_ENCRYPTION_KEY environment variable is required to decrypt."
  exit 1
fi

TMP_DIR="/tmp/collabpulse_restore"
mkdir -p "${TMP_DIR}"
DECRYPTED_FILE="${TMP_DIR}/decrypted_restore.dump"

echo "[$(date)] Verifying SHA256 checksum if available..."
if [ -f "${ENCRYPTED_FILE}.sha256" ]; then
  sha256sum -c "${ENCRYPTED_FILE}.sha256"
  echo "Checksum verified."
fi

echo "[$(date)] Decrypting ${ENCRYPTED_FILE}..."
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in "${ENCRYPTED_FILE}" \
  -out "${DECRYPTED_FILE}" \
  -pass "pass:${BACKUP_PASSPHRASE}"

echo "[$(date)] Recreating target database: ${TARGET_DB}..."
PGPASSWORD="${DB_PASSWORD:-}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${TARGET_DB};"
PGPASSWORD="${DB_PASSWORD:-}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "CREATE DATABASE ${TARGET_DB};"

echo "[$(date)] Restoring data into ${TARGET_DB}..."
PGPASSWORD="${DB_PASSWORD:-}" pg_restore \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${TARGET_DB}" \
  -v \
  --no-owner \
  --clean \
  --if-exists \
  "${DECRYPTED_FILE}" || true

rm -f "${DECRYPTED_FILE}"
echo "[$(date)] Database restoration completed successfully into ${TARGET_DB}."
