const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== STARTING COLLABPULSE E2E INTEGRATION SUITE ===\n');
  let testCount = 0;
  let passCount = 0;

  function assert(condition: boolean, message: string) {
    testCount++;
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Helper login
  async function login(email: string, password = 'CollabPulse2026!Admin') {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data: any = await res.json();
    return data;
  }

  // 1. Authenticate with Admin user
  console.log('--- 1. Authentication ---');
  const adminLogin = await login('admin@collabpulse.local');
  assert(adminLogin.success && !!adminLogin.data?.token, 'Admin login succeeded with JWT token');
  const adminToken = adminLogin.data.token;
  const adminUser = adminLogin.data.user;
  const authHeaders = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  // 2. Multi-tenant Organizations API
  console.log('\n--- 2. Multi-tenant Organizations ---');
  // List orgs
  const orgsRes = await fetch(`${BASE_URL}/api/v1/organizations`, { headers: authHeaders });
  const orgsData: any = await orgsRes.json();
  assert(orgsData.success && Array.isArray(orgsData.data), 'List organizations returns array');
  const defaultOrgId = orgsData.data[0]?.id;
  assert(!!defaultOrgId, `Default organization found: ${defaultOrgId}`);

  // Create new Organization
  const testOrgName = `Acme Enterprise ${Date.now()}`;
  const createOrgRes = await fetch(`${BASE_URL}/api/v1/organizations`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: testOrgName,
      slug: `acme-${Date.now()}`,
      primaryDomain: 'acme-corp.com'
    })
  });
  const createOrgData: any = await createOrgRes.json();
  assert(createOrgData.success && createOrgData.data?.name === testOrgName, 'Create organization with primary domain');
  const newOrgId = createOrgData.data.id;

  // Verify domains in organization
  const getOrgRes = await fetch(`${BASE_URL}/api/v1/organizations/${newOrgId}`, { headers: authHeaders });
  const getOrgData: any = await getOrgRes.json();
  assert(getOrgData.success && getOrgData.data?.domains?.length >= 1, 'Organization retrieves with associated domains');

  // Add domain
  const testDomain = `innovation-${Date.now()}.acme.com`;
  const addDomRes = await fetch(`${BASE_URL}/api/v1/organizations/${newOrgId}/domains`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ domain: testDomain, autoJoin: true })
  });
  const addDomData: any = await addDomRes.json();
  assert(addDomData.success && addDomData.data?.domain === testDomain, 'Add domain to organization');

  // 3. Domain-based User Registration
  console.log('\n--- 3. Domain-Based User Registration ---');
  const regEmail = `dev_${Date.now()}@${testDomain}`;
  const regRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Acme',
      lastName: 'Developer',
      userName: `dev_${Date.now()}`,
      email: regEmail,
      password: 'CollabPulse2026!Admin',
      department: 'Engineering'
    })
  });
  const regData: any = await regRes.json();
  console.log('Registered user data:', JSON.stringify(regData));
  console.log('Expected org id:', newOrgId);
  assert(regData.success && regData.data?.user?.tenantId === newOrgId, `New user auto-associated to organization ${newOrgId} by email domain`);
  const newUserId = regData.data.user.id;

  // 4. Physical File Upload, Streaming Download & Deletion
  console.log('\n--- 4. Physical Storage & Multer Uploads ---');
  const form = new FormData();
  const fileContent = 'CollabPulse Enterprise Verification File Buffer - Test Content ' + Date.now();
  const blob = new Blob([fileContent], { type: 'text/plain' });
  form.append('file', blob, 'integration_report.txt');
  form.append('channelId', 'c-general');

  const uploadRes = await fetch(`${BASE_URL}/api/v1/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    },
    body: form
  });
  const uploadData: any = await uploadRes.json();
  assert(uploadData.success && !!uploadData.data?.id, 'Physical file uploaded successfully via multer');
  const uploadedFileId = uploadData.data.id;

  // Stream download check
  const downloadRes = await fetch(`${BASE_URL}/api/v1/files/${uploadedFileId}/download`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(downloadRes.status === 200, 'File download endpoint returns 200 OK');
  const downloadedText = await downloadRes.text();
  assert(downloadedText === fileContent, 'Downloaded file content matches uploaded buffer exactly');

  // Delete file check
  const deleteFileRes = await fetch(`${BASE_URL}/api/v1/files/${uploadedFileId}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  const deleteFileData: any = await deleteFileRes.json();
  assert(deleteFileData.success, 'Physical file deletion endpoint succeeds');

  // 5. Conversation Lifecycle Management
  console.log('\n--- 5. Conversation Lifecycle Management ---');
  // Create group conversation
  const createConvRes = await fetch(`${BASE_URL}/api/v1/conversations`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      memberIds: [newUserId],
      isGroup: true,
      name: 'Sprint Retro Team'
    })
  });
  const createConvData: any = await createConvRes.json();
  assert(createConvData.success && !!createConvData.data?.id, 'Create group conversation succeeds');
  const testConvId = createConvData.data.id;

  // Rename conversation
  const renameConvRes = await fetch(`${BASE_URL}/api/v1/conversations/${testConvId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Architecture Council Q4' })
  });
  const renameConvData: any = await renameConvRes.json();
  assert(renameConvData.success && renameConvData.data?.name === 'Architecture Council Q4', 'Rename conversation succeeds');

  // Post message in conversation
  const postMsgRes = await fetch(`${BASE_URL}/api/v1/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      conversationId: testConvId,
      content: 'Bienvenido al comité de diseño y reunión de arquitectura'
    })
  });
  const postMsgData: any = await postMsgRes.json();
  assert(postMsgData.success && !!postMsgData.data?.id, 'Post message to conversation succeeds');

  // Remove member
  const removeMemRes = await fetch(`${BASE_URL}/api/v1/conversations/${testConvId}/members/${newUserId}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  const removeMemData: any = await removeMemRes.json();
  assert(removeMemData.success, 'Remove member from conversation succeeds');

  // 6. Task Comments & Persistence
  console.log('\n--- 6. Task Comments & Persistence ---');
  // Fetch tasks
  const tasksRes = await fetch(`${BASE_URL}/api/v1/tasks`, { headers: authHeaders });
  const tasksData: any = await tasksRes.json();
  const sampleTask = tasksData.data?.[0];
  assert(!!sampleTask, 'Retrieved sample task');

  // Add comment
  const addCommentRes = await fetch(`${BASE_URL}/api/v1/tasks/${sampleTask.id}/comments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ content: 'Verified this task in the integration test suite!' })
  });
  const addCommentData: any = await addCommentRes.json();
  assert(addCommentData.success && !!addCommentData.data?.id, 'Add task comment succeeds with ID');
  const commentId = addCommentData.data.id;

  // Get comments
  const getCommentsRes = await fetch(`${BASE_URL}/api/v1/tasks/${sampleTask.id}/comments`, { headers: authHeaders });
  const getCommentsData: any = await getCommentsRes.json();
  const foundComment = getCommentsData.data?.find((c: any) => c.id === commentId);
  assert(!!foundComment && foundComment.content.includes('Verified this task'), 'Get task comments retrieves persisted comment');

  // Delete comment
  const delCommentRes = await fetch(`${BASE_URL}/api/v1/tasks/${sampleTask.id}/comments/${commentId}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  const delCommentData: any = await delCommentRes.json();
  assert(delCommentData.success, 'Delete task comment succeeds');

  // 7. Accent-Insensitive Search
  console.log('\n--- 7. Accent-Insensitive Global Search ---');
  // Search with "reunión" vs "reunion"
  const search1Res = await fetch(`${BASE_URL}/api/v1/search?q=reunion`, { headers: authHeaders });
  const search1Data: any = await search1Res.json();
  const msgMatch1 = search1Data.data?.messages?.some((m: any) => m.content.includes('reunión'));
  assert(msgMatch1, 'Search for unaccented "reunion" matches message with accented "reunión"');

  const search2Res = await fetch(`${BASE_URL}/api/v1/search?q=diseño`, { headers: authHeaders });
  const search2Data: any = await search2Res.json();
  const msgMatch2 = search2Data.data?.messages?.some((m: any) => m.content.includes('diseño'));
  assert(msgMatch2, 'Search for accented "diseño" matches message');

  // 8. WebRTC Signaling & Call Endpoints
  console.log('\n--- 8. WebRTC Signaling & Calls ---');
  // Start / invite call
  const callRoomId = `call-test-${Date.now()}`;
  const inviteRes = await fetch(`${BASE_URL}/api/v1/realtime/signal/call/invite`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      targetUserId: newUserId,
      roomId: callRoomId,
      isVideo: true,
      conversationId: testConvId
    })
  });
  const inviteData: any = await inviteRes.json();
  assert(inviteData.success, 'Call invite signal dispatched');

  // Exchange WebRTC offer signal
  const offerRes = await fetch(`${BASE_URL}/api/v1/realtime/signal`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      targetUserId: newUserId,
      roomId: callRoomId,
      signalType: 'offer',
      data: { sdp: 'v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\ns=-\r\n' }
    })
  });
  const offerData: any = await offerRes.json();
  assert(offerData.success, 'WebRTC offer signal relayed');

  // End call
  const endCallRes = await fetch(`${BASE_URL}/api/v1/realtime/signal/call/end`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      targetUserId: newUserId,
      roomId: callRoomId
    })
  });
  const endCallData: any = await endCallRes.json();
  assert(endCallData.success, 'Call ended signal sent cleanly');

  // 9. Notifications Endpoint
  console.log('\n--- 9. Notifications & Persistence ---');
  const notifRes = await fetch(`${BASE_URL}/api/v1/notifications`, { headers: authHeaders });
  const notifData: any = await notifRes.json();
  assert(notifData.success && Array.isArray(notifData.data), 'Notifications list returns array');

  const readAllRes = await fetch(`${BASE_URL}/api/v1/notifications/read-all`, {
    method: 'POST',
    headers: authHeaders
  });
  const readAllData: any = await readAllRes.json();
  assert(readAllData.success, 'Mark all notifications as read succeeds');

  console.log(`\n=== E2E INTEGRATION SUITE COMPLETED: ${passCount}/${testCount} TESTS PASSED ===\n`);
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
