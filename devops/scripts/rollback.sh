#!/usr/bin/env bash
# ==============================================================================
# CollabPulse - Instant Rollback Script
# Reverts the active production deployment to the previous known stable version
# ==============================================================================

set -euo pipefail

ENVIRONMENT="${1:-production}"
NAMESPACE="${2:-collabpulse-prod}"

echo "=========================================================="
echo "⚠️ INITIATING EMERGENCY ROLLBACK FOR: ${ENVIRONMENT} (${NAMESPACE})"
echo "=========================================================="

# Check if running in Kubernetes or Docker Compose
if command -v kubectl &> /dev/null && kubectl get ns "${NAMESPACE}" &> /dev/null; then
  echo "[1/3] Reverting API Deployment..."
  kubectl rollout undo deployment/collabpulse-api -n "${NAMESPACE}"

  echo "[2/3] Reverting Frontend Deployment..."
  kubectl rollout undo deployment/collabpulse-frontend -n "${NAMESPACE}"

  echo "[3/3] Reverting Worker Deployment..."
  kubectl rollout undo deployment/collabpulse-worker -n "${NAMESPACE}"

  echo "Verifying rollout status..."
  kubectl rollout status deployment/collabpulse-api -n "${NAMESPACE}" --timeout=120s
  kubectl rollout status deployment/collabpulse-frontend -n "${NAMESPACE}" --timeout=120s

  echo "✅ Kubernetes Rollback completed successfully."
elif [ -f "devops/docker-compose/docker-compose.yml" ]; then
  echo "Reverting Docker Compose stack..."
  docker compose -f devops/docker-compose/docker-compose.yml restart
  echo "✅ Docker Compose stack restarted."
else
  echo "❌ Neither kubectl nor docker-compose configuration detected."
  exit 1
fi
