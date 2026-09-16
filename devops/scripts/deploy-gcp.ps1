<#
==============================================================================
 CollabPulse Enterprise — Google Cloud Run Automated Deployment (PowerShell)
==============================================================================
#>

param(
    [string]$ProjectId = "",
    [string]$Region = "us-central1",
    [string]$ServiceName = "collabpulse"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  🚀 CollabPulse Enterprise — Google Cloud Run Deploy  " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Check for gcloud CLI
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERROR: No se encontró 'gcloud' CLI instalado o en el PATH." -ForegroundColor Red
    Write-Host "Para desplegar desde el navegador sin instalar nada, consulta:" -ForegroundColor Yellow
    Write-Host "docs/deployment/GUIA_DESPLIEGUE_GOOGLE_CLOUD.md" -ForegroundColor Yellow
    exit 1
}

# Resolve project ID
if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    $ProjectId = (gcloud config get-value project 2>$null).Trim()
}

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    Write-Host "❌ ERROR: Debes especificar un Project ID de Google Cloud." -ForegroundColor Red
    Write-Host "Uso: .\devops\scripts\deploy-gcp.ps1 -ProjectId 'mi-proyecto-gcp' -Region 'us-central1'" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Proyecto GCP: $ProjectId" -ForegroundColor Green
Write-Host "🌎 Región:       $Region" -ForegroundColor Green
Write-Host "📦 Servicio:     $ServiceName" -ForegroundColor Green
Write-Host ""

# 1. Habilitar APIs
Write-Host "⚙️ [1/4] Habilitando APIs requeridas en Google Cloud..." -ForegroundColor Blue
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --project=$ProjectId

# 2. Verificar Artifact Registry
$RepoName = "collabpulse-repo"
Write-Host "📦 [2/4] Verificando repositorio Artifact Registry ($RepoName)..." -ForegroundColor Blue
$repoExists = gcloud artifacts repositories describe $RepoName --location=$Region --project=$ProjectId 2>$null
if (-not $repoExists) {
    Write-Host "Creando repositorio en Artifact Registry..." -ForegroundColor DarkGray
    gcloud artifacts repositories create $RepoName --repository-format=docker --location=$Region --description="Repositorio Docker CollabPulse" --project=$ProjectId
}

$ImageTag = "$Region-docker.pkg.dev/$ProjectId/$RepoName/app:latest"

# 3. Compilación en la nube con Cloud Build
Write-Host "🔨 [3/4] Compilando imagen en la nube con Google Cloud Build..." -ForegroundColor Blue
gcloud builds submit --tag $ImageTag --project=$ProjectId

# 4. Despliegue en Cloud Run
Write-Host "🚀 [4/4] Desplegando en Google Cloud Run..." -ForegroundColor Blue
gcloud run deploy $ServiceName `
    --image=$ImageTag `
    --region=$Region `
    --platform=managed `
    --allow-unauthenticated `
    --port=8080 `
    --min-instances=1 `
    --max-instances=10 `
    --cpu=1 `
    --memory=512Mi `
    --timeout=3600 `
    --set-env-vars="NODE_ENV=production,PORT=8080" `
    --project=$ProjectId

# Obtener URL del servicio
$ServiceUrl = (gcloud run services describe $ServiceName --platform=managed --region=$Region --project=$ProjectId --format="value(status.url)").Trim()

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  ✅ DESPLIEGUE COMPLETADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "🌐 URL Pública: $ServiceUrl" -ForegroundColor Cyan
Write-Host "🏥 Healthcheck: $ServiceUrl/health" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green
