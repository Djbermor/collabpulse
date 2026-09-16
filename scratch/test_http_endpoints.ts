/**
 * Live HTTP Integration Test for CollabPulse Phase 1 Call Engine Endpoints
 * Tests real HTTP calls against running server on http://localhost:3000
 */
import { pool } from '../src/db/index';
import { signJwt, JWT_SECRET } from '../server/security';
import { db } from '../server/db';

async function runHttpTests() {
  console.log('================================================================');
  console.log('--- TESTING LIVE HTTP CALL ENGINE ENDPOINTS (PORT 3000) ---');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:3000/api/v1';

  // 1. Authenticate via POST /api/v1/auth/login to obtain authentic JWT token
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'CollabPulse2026!Admin' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.data?.token) {
    console.error('Failed to log in as admin:', loginData);
    process.exit(1);
  }

  const tokenA = loginData.data.token;
  const userA = loginData.data.user;
  console.log(`Using Test User A: ${userA.userName} (${userA.id}), Tenant: ${userA.tenantId}`);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokenA}`,
    'X-Tenant-Id': userA.tenantId,
    'X-User-Id': userA.id
  };

  // Test 1: GET /api/v1/calls/ice-servers
  console.log('[HTTP TEST 1] GET /api/v1/calls/ice-servers');
  const iceRes = await fetch(`${BASE_URL}/calls/ice-servers`, { headers: authHeaders });
  const iceData = await iceRes.json();
  console.log('  Status:', iceRes.status, '| iceServers count:', iceData.data?.iceServers?.length);
  if (iceRes.status !== 200 || !iceData.data?.iceServers) {
    throw new Error('ice-servers failed');
  }

  // Test 2: POST /api/v1/calls/session-token
  console.log('\n[HTTP TEST 2] POST /api/v1/calls/session-token');
  const sessionTokenRes = await fetch(`${BASE_URL}/calls/session-token`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ callId: 'call-http-01', roomId: 'room-http-01' })
  });
  const sessionTokenData = await sessionTokenRes.json();
  console.log('  Status:', sessionTokenRes.status, '| token issued:', !!sessionTokenData.data?.token);
  if (sessionTokenRes.status !== 200 || !sessionTokenData.data?.token) {
    throw new Error('session-token failed');
  }

  // Test 3: POST /api/v1/calls/invite
  console.log('\n[HTTP TEST 3] POST /api/v1/calls/invite');
  // Find or create colleague in same tenant
  const userQuery = await pool.query('SELECT u.id, u.tenant_id, u.email, u.user_name FROM users u WHERE u.tenant_id = $1 AND u.id != $2 LIMIT 1', [userA.tenantId, userA.id]);
  let targetUser = userQuery.rows[0];
  if (!targetUser) {
    const newId = 'usr-colleague-' + Date.now();
    await pool.query(`INSERT INTO users (id, tenant_id, user_name, normalized_user_name, first_name, last_name, display_name) VALUES ($1, $2, $3, $3, 'Test', 'Colleague', 'Colleague') ON CONFLICT DO NOTHING`, [newId, userA.tenantId, 'colleague_' + Date.now()]);
    targetUser = { id: newId, tenantId: userA.tenantId };
  } else {
    targetUser.tenantId = targetUser.tenant_id;
  }

  const inviteRes = await fetch(`${BASE_URL}/calls/invite`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      targetUserId: targetUser.id,
      mediaType: 'video',
      title: 'Llamada de prueba HTTP'
    })
  });
  const inviteData = await inviteRes.json();
  console.log('  Status:', inviteRes.status, '| callId:', inviteData.data?.callId, '| roomId:', inviteData.data?.roomId);
  if (inviteRes.status !== 200 || !inviteData.data?.callId) {
    throw new Error('invite failed: ' + JSON.stringify(inviteData));
  }
  const callId = inviteData.data.callId;
  const roomId = inviteData.data.roomId;

  // Test 4: Multi-tab atomic claim on /api/v1/calls/claim
  console.log('\n[HTTP TEST 4] POST /api/v1/calls/claim (Multi-tab concurrency)');
  const claimTab1Res = await fetch(`${BASE_URL}/calls/claim`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ callId, tabId: 'chrome-tab-1' })
  });
  const claimTab1Data = await claimTab1Res.json();
  console.log('  Tab 1 Claim Status:', claimTab1Res.status, '| Code:', claimTab1Data.code);

  const claimTab2Res = await fetch(`${BASE_URL}/calls/claim`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ callId, tabId: 'chrome-tab-2' })
  });
  const claimTab2Data = await claimTab2Res.json();
  console.log('  Tab 2 Claim Status:', claimTab2Res.status, '| Code:', claimTab2Data.code);
  if (claimTab1Res.status !== 200 || claimTab2Res.status !== 409 || claimTab2Data.code !== 'CALL_ALREADY_CLAIMED') {
    throw new Error('Multi-tab claim validation failed');
  }

  // Test 5: POST /api/v1/calls/signal
  console.log('\n[HTTP TEST 5] POST /api/v1/calls/signal');
  const signalRes = await fetch(`${BASE_URL}/calls/signal`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      callId,
      roomId,
      targetUserId: targetUser.id,
      signalType: 'offer',
      data: { type: 'offer', sdp: 'v=0\r\no=mock 123 123 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' }
    })
  });
  const signalData = await signalRes.json();
  console.log('  Status:', signalRes.status, '| message:', signalData.message);
  if (signalRes.status !== 200) {
    throw new Error('signal failed');
  }

  // Test 6: POST /api/v1/calls/end
  console.log('\n[HTTP TEST 6] POST /api/v1/calls/end');
  const endRes = await fetch(`${BASE_URL}/calls/end`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      callId,
      roomId,
      targetUserId: targetUser.id,
      reason: 'completed'
    })
  });
  const endData = await endRes.json();
  console.log('  Status:', endRes.status, '| durationSeconds:', endData.data?.durationSeconds);
  if (endRes.status !== 200) {
    throw new Error('end failed');
  }

  // Test 7: GET /api/v1/calls/history
  console.log('\n[HTTP TEST 7] GET /api/v1/calls/history');
  const historyRes = await fetch(`${BASE_URL}/calls/history`, { headers: authHeaders });
  const historyData = await historyRes.json();
  console.log('  Status:', historyRes.status, '| history records count:', historyData.data?.length);
  if (historyRes.status !== 200 || !Array.isArray(historyData.data)) {
    throw new Error('history failed');
  }

  // Test 8: Strict Multi-Tenant Isolation (cross-tenant invite rejected with 403)
  console.log('\n[HTTP TEST 8] Multi-Tenant 403 TENANT_MISMATCH Check');
  const otherTenantId = 'tenant-other-' + Date.now();
  const otherUserId = 'usr-other-' + Date.now();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [otherTenantId, 'Other Corp', 'slug-other-' + Date.now()]);
  await pool.query(`INSERT INTO users (id, tenant_id, user_name, normalized_user_name, first_name, last_name, display_name) VALUES ($1, $2, $3, $3, 'Alien', 'User', 'Alien') ON CONFLICT DO NOTHING`, [otherUserId, otherTenantId, 'alien_' + Date.now()]);

  // Sync users into db
  db.users.push({ id: otherUserId, tenantId: otherTenantId, displayName: 'Alien' } as any);

  const crossInviteRes = await fetch(`${BASE_URL}/calls/invite`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      targetUserId: otherUserId,
      mediaType: 'video',
      title: 'Cross Tenant Call'
    })
  });
  const crossInviteData = await crossInviteRes.json();
  console.log('  Cross Tenant Invite Status:', crossInviteRes.status, '| Code:', crossInviteData.code);
  if (crossInviteRes.status !== 403 || crossInviteData.code !== 'TENANT_MISMATCH') {
    throw new Error('Tenant isolation failed: cross-tenant call was not rejected with 403 TENANT_MISMATCH');
  }

  console.log('\n================================================================');
  console.log('--- ALL LIVE HTTP CALL ENGINE ENDPOINTS PASSED SUCCESSFULLY! ---');
  console.log('================================================================');

  await pool.end();
}

runHttpTests().catch(err => {
  console.error('Fatal HTTP test error:', err);
  process.exit(1);
});
