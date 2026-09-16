#!/usr/bin/env bash
# ==============================================================================
# CollabPulse Enterprise — Google Cloud Run Automated Deployment
# ==============================================================================

set -euo pipefail

echo "========================================================"
echo "  🚀 CollabPulse Enterprise — Google Cloud Run Deploy  "
echo "========================================================"

# Default parameters
PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${2:-us-central1}"
SERVICE_NAME="collabpulse"

if [ -z "${PROJECT_ID}" ]; then
  echo "❌ ERROR: No active Google Cloud project found."
  echo "Uso: ./devops/scripts/deploy-gcp.sh <PROJECT_ID> [REGION]"
  echo "O ejecuta primero: gcloud config set project <TU_PROJECT_ID>"
  exit 1
fi

echo "📋 Proyecto GCP: ${PROJECT_ID}"
echo "🌎 Región:       ${REGION}"
echo "📦 Servicio:     ${SERVICE_NAME}"
echo ""

# 1. Habilitar APIs necesarias en Google Cloud
echo "⚙️ [1/4] Verificando y habilitando APIs de Google Cloud..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project="${PROJECT_ID}"

# 2. Crear repositorio de Artifact Registry si no existe
REPO_NAME="collabpulse-repo"
echo "📦 [2/4] Verificando repositorio de Artifact Registry (${REPO_NAME})..."
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "Creando repositorio en Artifact Registry..."
  gcloud artifacts repositories create "${REPO_NAME}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Repositorio Docker para CollabPulse Enterprise" \
    --project="${PROJECT_ID}"
fi

IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/app:latest"

# 3. Compilar la imagen usando Google Cloud Build (directo en la nube)
echo "🔨 [3/4] Compilando contenedor con Google Cloud Build..."
gcloud builds submit --tag "${IMAGE_TAG}" --project="${PROJECT_ID}"

# 4. Desplegar en Google Cloud Run
echo "🚀 [4/4] Desplegando en Google Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_TAG}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --min-instances=1 \
  --max-instances=10 \
  --cpu=1 \
  --memory=512Mi \
  --timeout=3600 \
  --set-env-vars="NODE_ENV=production,PORT=8080" \
  --project="${PROJECT_ID}"

# Obtener URL del servicio desplegado
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --platform=managed --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)')

echo ""
echo "========================================================"
echo "  ✅ DESPLIEGUE COMPLETADO EXITOSAMENTE"
echo "========================================================"
echo "🌐 URL Pública: ${SERVICE_URL}"
echo "🏥 Healthcheck: ${SERVICE_URL}/health"
echo "========================================================"
