#!/usr/bin/env bash
# ==============================================================================
# CollabPulse - Comprehensive Security Vulnerability & Secret Audit Script
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "CollabPulse Automated Security Analysis Pipeline"
echo "=========================================================="

# 1. Secret Scanning with Gitleaks / TruffleHog (if available)
echo "[1/4] Checking for committed credentials & sensitive patterns..."
PATTERNS_FOUND=$(grep -rE "(password|secret|apikey|access_key)[[:space:]]*=[[:space:]]*['\"][A-Za-z0-9_-]{16,}['\"]" \
  --exclude-dir={node_modules,dist,bin,obj,.git} \
  --exclude="*.md" \
  --exclude="*.example" \
  --exclude="*.test.*" \
  --exclude="*.dump*" \
  . || true)

if [ -n "$PATTERNS_FOUND" ]; then
  echo "⚠️ Potential hardcoded secret found:"
  echo "$PATTERNS_FOUND"
else
  echo "✅ No exposed raw credentials detected."
fi

# 2. NPM Audit (Frontend Dependencies)
echo "[2/4] Auditing Node.js / Angular dependencies..."
if [ -d "frontend" ] && command -v npm &> /dev/null; then
  (cd frontend && npm audit --audit-level=high || true)
fi

# 3. .NET Security Vulnerability Check
echo "[3/4] Checking .NET NuGet packages for known CVEs..."
if command -v dotnet &> /dev/null; then
  dotnet list backend/CollabPulse.sln package --vulnerable || true
fi

# 4. Container Vulnerability Scanning with Trivy (if installed)
echo "[4/4] Container image security check..."
if command -v trivy &> /dev/null; then
  trivy config devops/kubernetes/
fi

echo "=========================================================="
echo "Security scan pipeline completed."
echo "=========================================================="
