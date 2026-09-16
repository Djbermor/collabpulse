import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

async function req(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const headers: any = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=== Starting CollabPulse Verification Suite ===\n');

  // 1. Health & Ready
  console.log('1. Checking server health and readiness...');
  const health = await req('/health');
  if (health.status !== 200) throw new Error(`Health check failed: ${JSON.stringify(health)}`);
  console.log('   ✓ /health: 200 OK', health.data);

  const ready = await req('/ready');
  if (ready.status !== 200) throw new Error(`Ready check failed: ${JSON.stringify(ready)}`);
  console.log('   ✓ /ready: 200 OK', ready.data);

  // 2. Admin Login
  console.log('\n2. Testing Admin Login...');
  const loginRes = await req('/api/v1/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@collabpulse.local',
      password: ADMIN_PASSWORD
    }
  });
  if (!loginRes.ok || !loginRes.data?.data?.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginRes)}`);
  }
  const adminToken = loginRes.data.data.token;
  const adminUser = loginRes.data.data.user;
  const adminTenantId = adminUser.tenantId;
  const adminWorkspaceId = loginRes.data.data.workspace?.id || '';
  console.log(`   ✓ Logged in as: ${adminUser.email} (Role: ${adminUser.role})`);
  console.log(`   ✓ Workspace: ${loginRes.data.data.workspace?.name || 'Default'} (${adminWorkspaceId})`);

  // 3. Admin Logout & Immediate Re-login (Lockout Verification)
  console.log('\n3. Testing Logout -> Immediate Re-login (Lockout Bug Prevention)...');
  const logoutRes = await req('/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'x-tenant-id': adminTenantId
    }
  });
  if (!logoutRes.ok) throw new Error(`Logout failed: ${JSON.stringify(logoutRes)}`);
  console.log('   ✓ Admin logged out successfully');

  // Immediately re-login
  const reloginRes = await req('/api/v1/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@collabpulse.local',
      password: ADMIN_PASSWORD
    }
  });
  if (!reloginRes.ok || !reloginRes.data?.data?.token) {
    throw new Error(`Re-login immediately failed (Lockout bug detected!): ${JSON.stringify(reloginRes)}`);
  }
  const activeAdminToken = reloginRes.data.data.token;
  console.log('   ✓ Immediate re-login succeeded! Zero lockout issues.');

  const adminHeaders = {
    Authorization: `Bearer ${activeAdminToken}`,
    'x-tenant-id': adminTenantId,
    'x-workspace-id': adminWorkspaceId
  };

  // 4. Register Second Collaborator (Maria Santos)
  console.log('\n4. Registering Second Collaborator (Maria Santos)...');
  const regRes = await req('/api/v1/auth/register', {
    method: 'POST',
    body: {
      email: 'maria.santos@collabpulse.local',
      firstName: 'María',
      lastName: 'Santos',
      password: 'MariaCollabPulse2026!',
      jobTitle: 'Ingeniera de Software'
    }
  });
  let mariaUser: any;
  let mariaToken: string;
  if (regRes.ok) {
    mariaUser = regRes.data.data.user;
    mariaToken = regRes.data.data.token;
    console.log(`   ✓ Registered: ${mariaUser.email} (${mariaUser.id})`);
  } else {
    // If already registered, login
    const mariaLogin = await req('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'maria.santos@collabpulse.local',
        password: 'MariaCollabPulse2026!'
      }
    });
    if (!mariaLogin.ok) throw new Error(`Maria auth failed: ${JSON.stringify(mariaLogin)}`);
    mariaUser = mariaLogin.data.data.user;
    mariaToken = mariaLogin.data.data.token;
    console.log(`   ✓ Logged in as existing: ${mariaUser.email}`);
  }

  const mariaHeaders = {
    Authorization: `Bearer ${mariaToken}`,
    'x-tenant-id': adminTenantId,
    'x-workspace-id': adminWorkspaceId
  };

  // 5. Test Channel Creation & Channel Messaging
  console.log('\n5. Testing Channel Creation & Messaging...');
  let channel: any;
  const createChannelRes = await req('/api/v1/channels', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'general',
      topic: 'Canal general de la empresa',
      isPrivate: false
    }
  });
  if (createChannelRes.ok) {
    channel = createChannelRes.data.data;
    console.log(`   ✓ Channel created: #${channel.name} (${channel.id})`);
  } else {
    const listChannelsRes = await req('/api/v1/channels', { method: 'GET', headers: adminHeaders });
    channel = listChannelsRes.data.data.find((c: any) => c.name === 'general');
    console.log(`   ✓ Existing channel retrieved: #${channel.name} (${channel.id})`);
  }

  // Send message to channel
  const sendMsgRes = await req('/api/v1/messages', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      channelId: channel.id,
      content: '¡Bienvenidos a CollabPulse! Sistema 100% operativo conectado a PostgreSQL.'
    }
  });
  if (!sendMsgRes.ok) throw new Error(`Sending channel message failed: ${JSON.stringify(sendMsgRes)}`);
  const channelMsg = sendMsgRes.data.data;
  console.log(`   ✓ Channel message sent: "${channelMsg.content}" (ID: ${channelMsg.id})`);

  // Add reaction to message
  const reactRes = await req(`/api/v1/messages/${channelMsg.id}/reactions`, {
    method: 'POST',
    headers: adminHeaders,
    body: { emoji: '🚀' }
  });
  if (!reactRes.ok) throw new Error(`Reaction failed: ${JSON.stringify(reactRes)}`);
  console.log('   ✓ Reaction 🚀 added to channel message');

  // 6. Test Collaborator Search & 1:1 Direct Messages
  console.log('\n6. Testing Collaborator Search & 1:1 Direct Messages...');
  const searchUsersRes = await req('/api/v1/workspaces/users?q=maria', {
    method: 'GET',
    headers: adminHeaders
  });
  if (!searchUsersRes.ok) throw new Error(`Search users failed: ${JSON.stringify(searchUsersRes)}`);
  console.log(`   ✓ Found ${searchUsersRes.data.data.length} users matching 'maria':`, searchUsersRes.data.data.map((u: any) => u.displayName));

  // Create 1:1 DM
  const createDmRes = await req('/api/v1/conversations', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      targetUserId: mariaUser.id
    }
  });
  if (!createDmRes.ok) throw new Error(`Create DM failed: ${JSON.stringify(createDmRes)}`);
  const conversation = createDmRes.data.data;
  console.log(`   ✓ 1:1 DM Conversation opened: ${conversation.id} with ${conversation.displayName}`);

  // Deduplication check: call create again with same targetUserId
  const dedupRes = await req('/api/v1/conversations', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      targetUserId: mariaUser.id
    }
  });
  if (!dedupRes.ok || dedupRes.data.data.id !== conversation.id) {
    throw new Error('Deduplication failed: got a different conversation ID!');
  }
  console.log('   ✓ Deduplication verified: subsequent create returns existing conversation ID.');

  // Send message in 1:1 DM from Admin to Maria
  const sendDmRes = await req('/api/v1/messages', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      conversationId: conversation.id,
      content: 'Hola María, ¿cómo va la integración de CollabPulse?'
    }
  });
  if (!sendDmRes.ok) throw new Error(`Send DM failed: ${JSON.stringify(sendDmRes)}`);
  console.log(`   ✓ Admin sent DM: "${sendDmRes.data.data.content}"`);

  // Maria fetches messages
  const mariaGetDmMessages = await req(`/api/v1/messages?conversationId=${conversation.id}`, {
    method: 'GET',
    headers: mariaHeaders
  });
  if (!mariaGetDmMessages.ok || mariaGetDmMessages.data.data.length === 0) {
    throw new Error(`Maria failed to fetch DM messages: ${JSON.stringify(mariaGetDmMessages)}`);
  }
  console.log(`   ✓ Maria retrieved ${mariaGetDmMessages.data.data.length} messages in conversation`);

  // Maria replies
  const mariaReplyRes = await req('/api/v1/messages', {
    method: 'POST',
    headers: mariaHeaders,
    body: {
      conversationId: conversation.id,
      content: '¡Hola! Todo funcionando de maravilla en PostgreSQL 16 sin mocks.'
    }
  });
  if (!mariaReplyRes.ok) throw new Error(`Maria reply failed: ${JSON.stringify(mariaReplyRes)}`);
  console.log(`   ✓ Maria replied: "${mariaReplyRes.data.data.content}"`);

  // 7. Test WebRTC Signaling Hub
  console.log('\n7. Testing WebRTC Signaling Hub...');
  // Admin invites Maria to video call
  const inviteCallRes = await req('/api/v1/realtime/signal/call/invite', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      targetUserId: mariaUser.id,
      conversationId: conversation.id,
      isVideo: true
    }
  });
  if (!inviteCallRes.ok) throw new Error(`Call invite failed: ${JSON.stringify(inviteCallRes)}`);
  const callId = inviteCallRes.data.data.callId;
  console.log(`   ✓ Video call invite sent to Maria (Call ID: ${callId})`);

  // Maria responds: accept
  const respondCallRes = await req('/api/v1/realtime/signal/call/response', {
    method: 'POST',
    headers: mariaHeaders,
    body: {
      callerId: adminUser.id,
      callId,
      accepted: true
    }
  });
  if (!respondCallRes.ok) throw new Error(`Call response failed: ${JSON.stringify(respondCallRes)}`);
  console.log('   ✓ Maria accepted call');

  // Exchange SDP Offer / Answer
  const offerSignalRes = await req('/api/v1/realtime/signal', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      signalType: 'webrtc-offer',
      targetUserId: mariaUser.id,
      roomId: conversation.id,
      data: { sdp: 'v=0\r\no=admin 1234 5678 IN IP4 127.0.0.1...' }
    }
  });
  if (!offerSignalRes.ok) throw new Error(`SDP offer signal failed: ${JSON.stringify(offerSignalRes)}`);
  console.log('   ✓ WebRTC Offer relayed via signaling hub');

  const answerSignalRes = await req('/api/v1/realtime/signal', {
    method: 'POST',
    headers: mariaHeaders,
    body: {
      signalType: 'webrtc-answer',
      targetUserId: adminUser.id,
      roomId: conversation.id,
      data: { sdp: 'v=0\r\no=maria 5678 1234 IN IP4 127.0.0.1...' }
    }
  });
  if (!answerSignalRes.ok) throw new Error(`SDP answer signal failed: ${JSON.stringify(answerSignalRes)}`);
  console.log('   ✓ WebRTC Answer relayed via signaling hub');

  // 8. Test Tasks
  console.log('\n8. Testing Tasks & Kanban...');
  const createTaskRes = await req('/api/v1/tasks', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      title: 'Auditar despliegue en producción',
      description: 'Verificar certificados SSL, backups y registros de auditoría',
      status: 'Todo',
      priority: 'High',
      assigneeId: mariaUser.id
    }
  });
  if (!createTaskRes.ok) throw new Error(`Create task failed: ${JSON.stringify(createTaskRes)}`);
  const task = createTaskRes.data.data;
  console.log(`   ✓ Task created: "${task.title}" (${task.id})`);

  const updateTaskRes = await req(`/api/v1/tasks/${task.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: {
      status: 'In Progress'
    }
  });
  if (!updateTaskRes.ok) throw new Error(`Update task failed: ${JSON.stringify(updateTaskRes)}`);
  console.log(`   ✓ Task updated to status: ${updateTaskRes.data.data.status}`);

  // 9. Test Calendar Events
  console.log('\n9. Testing Calendar Events...');
  const createEventRes = await req('/api/v1/calendar', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      title: 'Revisión General de Sprint 1',
      description: 'Demostración de la plataforma CollabPulse',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600000).toISOString(),
      location: 'Sala Virtual A'
    }
  });
  if (!createEventRes.ok) throw new Error(`Create calendar event failed: ${JSON.stringify(createEventRes)}`);
  console.log(`   ✓ Calendar event created: "${createEventRes.data.data.title}"`);

  console.log('\n=== All Verification Checks Passed Successfully! ===\n');
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
