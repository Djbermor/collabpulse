import http from 'k6/http';
import { check, sleep } from 'k6';

// ==============================================================================
// CollabPulse Enterprise — k6 API Load Test (Section 55)
// Simula 1,000 usuarios concurrentes validando SLOs estrictos:
// P50 < 50ms | P95 < 200ms | P99 < 500ms | Tasa de Error < 0.1%
// ==============================================================================

export const options = {
  stages: [
    { duration: '1m', target: 250 },   // Rampa inicial
    { duration: '2m', target: 1000 },  // Escalado a 1,000 VUs concurrentes
    { duration: '5m', target: 1000 },  // Carga sostenida
    { duration: '1m', target: 200 },   // Rampa descendente
    { duration: '1m', target: 0 },     // Enfriamiento final
  ],
  thresholds: {
    'http_req_duration{status:200}': [
      'p(50)<50',    // P50 por debajo de 50ms
      'p(95)<200',   // P95 por debajo de 200ms
      'p(99)<500',   // P99 por debajo de 500ms
    ],
    'http_req_failed': ['rate<0.001'], // Menos del 0.1% de errores
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5000/api/v1';
const TEST_TOKEN = __ENV.JWT_TOKEN || 'test-bearer-token-for-load';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'X-Correlation-ID': `k6-${__VU}-${__ITER}`,
  };

  // 1. Health & Readiness Probe
  const healthRes = http.get(`${BASE_URL}/health/ready`);
  check(healthRes, {
    'health ready 200': (r) => r.status === 200,
  });

  // 2. Consulta de Canales del Workspace (Read Heavy)
  const channelsRes = http.get(`${BASE_URL}/workspaces/22222222-2222-2222-2222-222222222222/channels`, { headers });
  check(channelsRes, {
    'channels status 200': (r) => r.status === 200,
  });

  // 3. Consulta de Mensajes con Paginación por Cursor
  const messagesRes = http.get(
    `${BASE_URL}/channels/33333333-3333-3333-3333-333333333333/messages?limit=50`,
    { headers }
  );
  check(messagesRes, {
    'messages status 200': (r) => r.status === 200,
  });

  // 4. Envío de Mensaje Sintético (Write Load)
  const payload = JSON.stringify({
    content: `Load test pulse from VU ${__VU} iteration ${__ITER}`,
    type: 'text',
    idempotencyKey: `k6-msg-${__VU}-${__ITER}-${Date.now()}`,
  });

  const sendMsgRes = http.post(
    `${BASE_URL}/channels/33333333-3333-3333-3333-333333333333/messages`,
    payload,
    { headers }
  );
  check(sendMsgRes, {
    'send message 201 or 200': (r) => r.status === 201 || r.status === 200,
  });

  sleep(1);
}
