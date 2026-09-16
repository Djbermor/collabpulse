#!/usr/bin/env bash
# ==============================================================================
# CollabPulse - Deployment Orchestration Script
# ==============================================================================

set -euo pipefail

ENV="${1:-dev}"
VERSION="${2:-latest}"

echo "Starting CollabPulse deployment for [${ENV}] with tag [${VERSION}]..."

if [ "${ENV}" == "dev" ]; then
  docker compose -f devops/docker-compose/docker-compose.yml -f devops/docker-compose/docker-compose.dev.yml up -d --build
elif [ "${ENV}" == "prod" ]; then
  kubectl apply -f devops/kubernetes/namespace.yaml
  kubectl apply -f devops/kubernetes/configmap.yaml
  kubectl apply -f devops/kubernetes/network-policy.yaml
  kubectl apply -f devops/kubernetes/api-deployment.yaml
  kubectl apply -f devops/kubernetes/api-service.yaml
  kubectl apply -f devops/kubernetes/frontend-deployment.yaml
  kubectl apply -f devops/kubernetes/frontend-service.yaml
  kubectl apply -f devops/kubernetes/worker-deployment.yaml
  kubectl apply -f devops/kubernetes/ingress.yaml
  kubectl apply -f devops/kubernetes/hpa.yaml
  echo "Applying rollouts..."
  kubectl rollout status deployment/collabpulse-frontend -n collabpulse-prod --timeout=180s
fi

echo "Deployment finished."
