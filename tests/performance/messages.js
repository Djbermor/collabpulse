import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ==============================================================================
// CollabPulse Enterprise — Messages Performance & SignalR Latency (Section 58)
// Scenario: Concurrent message creation, channel broadcasting, latency threshold
// Target: p95 < 200ms, Error rate < 1%
// ==============================================================================

const MessageLatency = new Trend('collabpulse_message_post_latency', true);
const RealtimeBroadcastLatency = new Trend('collabpulse_realtime_broadcast_latency', true);
const SuccessfulMessages = new Counter('collabpulse_successful_messages');
const FailedMessages = new Rate('collabpulse_failed_messages_rate');

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Warm-up ramp
    { duration: '1m', target: 200 },   // High-concurrency load
    { duration: '30s', target: 500 },  // Peak stress
    { duration: '30s', target: 0 }     // Graceful ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<200', 'p(99)<500'],
    'collabpulse_message_post_latency': ['p(95)<200'],
    'collabpulse_failed_messages_rate': ['rate<0.01']
  }
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api/v1';
const TENANT_ID = 'tenant-demo-001';
const CHANNEL_ID = 'chn-general-01';
const USER_ID = 'usr-admin-01';

export default function () {
  const payload = JSON.stringify({
    channelId: CHANNEL_ID,
    content: `Benchmark load message from VU ${__VU} iteration ${__ITER} at ${Date.now()}`,
    type: 0 // MessageType.Standard
  });

  const headers = {
    'Content-Type': 'application/json',
    'X-Tenant-Id': TENANT_ID,
    'X-User-Id': USER_ID,
    'Authorization': 'Bearer benchmark-perf-token'
  };

  const startTime = new Date().getTime();
  const res = http.post(`${BASE_URL}/messages`, payload, { headers });
  const latency = new Date().getTime() - startTime;

  MessageLatency.add(latency);

  const isSuccess = check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'latency under 200ms': () => latency < 200
  });

  if (isSuccess) {
    SuccessfulMessages.add(1);
    FailedMessages.add(0);
  } else {
    FailedMessages.add(1);
  }

  sleep(0.5);
}
