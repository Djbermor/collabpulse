#!/usr/bin/env bash
# ==============================================================================
# CollabPulse - Automated Post-Deployment Smoke Test Suite
# ==============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost}"

echo "=========================================================="
echo "Executing CollabPulse Production Smoke Tests against: ${BASE_URL}"
echo "=========================================================="

FAILED=0

check_endpoint() {
  local endpoint="$1"
  local expected_status="${2:-200}"
  local url="${BASE_URL}${endpoint}"

  echo -n "Checking ${url} (Expected HTTP ${expected_status})... "

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "${url}" || echo "000")

  if [ "${status}" -eq "${expected_status}" ]; then
    echo "✅ PASS (${status})"
  else
    echo "❌ FAIL (${status})"
    FAILED=$((FAILED + 1))
  fi
}

# 1. Frontend Web App Health
check_endpoint "/" 200
check_endpoint "/health" 200

# 2. Backend Health & Readiness Probes
check_endpoint "/api/health" 200

# 3. Security Headers Test
echo -n "Testing for HSTS / Security Headers... "
HEADERS=$(curl -s -I --connect-timeout 5 "${BASE_URL}/" || true)
if echo "${HEADERS}" | grep -iq "x-frame-options"; then
  echo "✅ PASS"
else
  echo "⚠️ WARNING: X-Frame-Options not found in response"
fi

if [ ${FAILED} -gt 0 ]; then
  echo "=========================================================="
  echo "❌ SMOKE TESTS FAILED: ${FAILED} assertions failed."
  echo "=========================================================="
  exit 1
fi

echo "=========================================================="
echo "✅ ALL SMOKE TESTS PASSED SUCCESSFULLY!"
echo "=========================================================="
exit 0
