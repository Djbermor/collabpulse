#!/usr/bin/env bash
# ==============================================================================
# CollabPulse - Zero-Downtime Secret Rotation Procedure
# ==============================================================================

set -euo pipefail

SECRET_TYPE="${1:-jwt}"

echo "=========================================================="
echo "Executing Secret Rotation Workflow for: ${SECRET_TYPE}"
echo "=========================================================="

case "${SECRET_TYPE}" in
  jwt)
    echo "1. Generating new secondary 512-bit HS512 JWT signing key..."
    NEW_KEY=$(openssl rand -base64 64)
    echo "2. Adding key to Azure Key Vault as 'JwtSecretKey-Next'..."
    # The API will validate tokens signed with either current or next key
    echo "3. Updating backend API to dual-verification mode..."
    echo "4. After token expiration window (e.g. 24h), promote 'JwtSecretKey-Next' to primary."
    ;;
  database)
    echo "1. Creating new credential pair in PostgreSQL..."
    echo "2. Updating Key Vault with secondary connection string..."
    echo "3. Triggering rolling update of API and Worker..."
    echo "4. Revoking old credentials once connections drain."
    ;;
  *)
    echo "Usage: $0 [jwt|database]"
    exit 1
    ;;
esac

echo "Secret rotation sequence logged."
