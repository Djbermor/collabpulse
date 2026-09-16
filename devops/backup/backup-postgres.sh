#!/usr/bin/env bash
# ==============================================================================
# CollabPulse - Automated Database Backup Script
# Creates compressed, AES-256 encrypted database dumps and pushes to Cloud Storage
# ==============================================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_DAY=$(date +"%Y-%m-%d")
BACKUP_DIR="/tmp/collabpulse_backups"
BACKUP_FILENAME="collabpulse_db_${TIMESTAMP}.dump"
ENCRYPTED_FILENAME="${BACKUP_FILENAME}.enc"
LOG_FILE="/var/log/collabpulse_backup.log"

# Default configuration from environment
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-collabpulse_prod}"
DB_USER="${DB_USER:-collabpulse_admin}"
STORAGE_CONTAINER="${AZURE_BACKUP_CONTAINER:-collabpulse-backups}"
BACKUP_PASSPHRASE="${BACKUP_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting automated backup of ${DB_NAME}..." | tee -a "${LOG_FILE}"

# 1. Execute pg_dump with custom format (optimized for pg_restore)
PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -F c \
  -b \
  -v \
  -f "${BACKUP_DIR}/${BACKUP_FILENAME}" 2>> "${LOG_FILE}"

FILE_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILENAME}" | cut -f1)
echo "[$(date)] Backup completed successfully. Unencrypted size: ${FILE_SIZE}" | tee -a "${LOG_FILE}"

# 2. AES-256-CBC Encryption
echo "[$(date)] Encrypting backup with OpenSSL AES-256-CBC..." | tee -a "${LOG_FILE}"
openssl enc -aes-256-cbc -salt -pbkdf2 \
  -in "${BACKUP_DIR}/${BACKUP_FILENAME}" \
  -out "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" \
  -pass "pass:${BACKUP_PASSPHRASE}"

# Calculate SHA256 checksum for integrity validation
sha256sum "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" > "${BACKUP_DIR}/${ENCRYPTED_FILENAME}.sha256"

# 3. Upload to Azure Blob Storage / S3
if command -v az &> /dev/null; then
  echo "[$(date)] Uploading encrypted backup to Azure Blob Storage container: ${STORAGE_CONTAINER}..." | tee -a "${LOG_FILE}"
  az storage blob upload \
    --container-name "${STORAGE_CONTAINER}" \
    --file "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" \
    --name "daily/${DATE_DAY}/${ENCRYPTED_FILENAME}" \
    --auth-mode login

  az storage blob upload \
    --container-name "${STORAGE_CONTAINER}" \
    --file "${BACKUP_DIR}/${ENCRYPTED_FILENAME}.sha256" \
    --name "daily/${DATE_DAY}/${ENCRYPTED_FILENAME}.sha256" \
    --auth-mode login
else
  echo "[$(date)] Azure CLI not found, keeping backup locally in ${BACKUP_DIR}" | tee -a "${LOG_FILE}"
fi

# 4. Cleanup local unencrypted dump
rm -f "${BACKUP_DIR}/${BACKUP_FILENAME}"
echo "[$(date)] Backup operation finished successfully." | tee -a "${LOG_FILE}"
