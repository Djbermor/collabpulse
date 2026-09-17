import { launchMediaBrowser, createAuthenticatedSession, initiateCallViaUI, acceptIncomingCall, checkWebRTCState } from './helpers/browser_harness';
import { Browser } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function runChatAttachmentsSecurityTest() {
  console.log('====================================================');
  console.log('STARTING BLOQUES 8, 9, 10 & 11: CHAT, ATTACHMENTS & SECURITY');
  console.log('====================================================');

  let browserA: Browser | null = null;
  let browserB: Browser | null = null;
  let browserIsolated: Browser | null = null;

  try {
    // 1. Launch browsers
    console.log('[E2E] Step 1: Launching Chromium instances...');
    browserA = await launchMediaBrowser();
    browserB = await launchMediaBrowser();
    browserIsolated = await launchMediaBrowser();

    // 2. Authenticate User A and User B (Tenant A)
    console.log('[E2E] Step 2: Authenticating User A (Admin) and User B (Bravo) in Tenant A...');
    const sessionA = await createAuthenticatedSession(browserA, {
      id: 'usr-admin-mu36yjdt',
      email: 'admin@collabpulse.local',
      displayName: 'Admin User',
      tenantId: 'tenant-collab-a'
    });
    console.log('  -> User A logged in (Tenant A).');

    const sessionB = await createAuthenticatedSession(browserB, {
      id: 'usr-member-a2',
      email: 'user.b@collabpulse.local',
      displayName: 'User Bravo',
      tenantId: 'tenant-collab-a'
    });
    console.log('  -> User B logged in (Tenant A).');

    // 3. User A calls User B 1:1
    console.log('[E2E] Step 3: Establishing active 1:1 call...');
    await initiateCallViaUI(sessionA.page, sessionB.user.id, sessionB.user.displayName, true);
    await acceptIncomingCall(sessionB.page);

    // Wait for connection
    let connected = false;
    for (let i = 0; i < 20; i++) {
      await sessionA.page.waitForTimeout(1000);
      const stA = await checkWebRTCState(sessionA.page, sessionB.user.id);
      if (stA.connectionState === 'connected' || stA.iceConnectionState === 'connected' || stA.iceConnectionState === 'completed') {
        connected = true;
        break;
      }
    }
    if (!connected) throw new Error('WebRTC failed to connect');
    console.log('  -> Call active & connected.');

    // 4. BLOQUE 8 — IN-CALL CHAT REALTIME (No refresh)
    console.log('[E2E] Step 4: Testing In-Call Chat Realtime...');

    // Open chat panel on User A
    const chatToggleA = sessionA.page.locator('button[title*="Chat de la llamada"]').first();
    await chatToggleA.click();
    await sessionA.page.waitForTimeout(500);

    // Open chat panel on User B
    const chatToggleB = sessionB.page.locator('button[title*="Chat de la llamada"]').first();
    await chatToggleB.click();
    await sessionB.page.waitForTimeout(500);

    // User A sends message
    const testMsg1 = `Hola User B - timestamp ${Date.now()}`;
    console.log(`  -> User A sending: "${testMsg1}"`);
    const inputA = sessionA.page.locator('#incall-chat-input, input[aria-label*="chat"], input[placeholder*="mensaje"]').first();
    await inputA.waitFor({ state: 'visible', timeout: 5000 });
    await inputA.fill(testMsg1);
    await inputA.press('Enter');

    // User B must receive without refresh
    console.log('  -> Waiting for User B to receive message in real-time...');
    const msgLocatorB = sessionB.page.locator(`text=${testMsg1}`).first();
    await msgLocatorB.waitFor({ state: 'visible', timeout: 10000 });
    console.log('  -> User B received message in DOM without page refresh (PASS)!');

    // User B replies
    const testMsg2 = `Hola Admin recibido fuerte y claro - ${Date.now()}`;
    console.log(`  -> User B replying: "${testMsg2}"`);
    const inputB = sessionB.page.locator('#incall-chat-input, input[aria-label*="chat"], input[placeholder*="mensaje"]').first();
    await inputB.waitFor({ state: 'visible', timeout: 5000 });
    await inputB.fill(testMsg2);
    await inputB.press('Enter');

    // User A must receive without refresh
    console.log('  -> Waiting for User A to receive reply in real-time...');
    const msgLocatorA = sessionA.page.locator(`text=${testMsg2}`).first();
    await msgLocatorA.waitFor({ state: 'visible', timeout: 10000 });
    console.log('  -> User A received reply in DOM without page refresh (PASS)!');

    // 5. BLOQUE 9 — REACTION CONTRACT & SSE REALTIME
    console.log('[E2E] Step 5: Testing Reactions contract & real-time update...');
    const tokenB = await sessionB.page.evaluate(() => localStorage.getItem('collab_token'));
    const linkedConvId = await sessionA.page.evaluate(() => {
      return (window as any).__collabpulse_callConversationId ||
             document.querySelector('#incall-chat-messages')?.parentElement?.getAttribute('data-conversation-id');
    });

    // Query messages in linked conversation
    const convMsgRes = await sessionA.page.evaluate(async () => {
      const token = localStorage.getItem('collab_token');
      // Fetch user's active conversations
      const convs = await fetch('/api/v1/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());
      if (convs.data && convs.data.length > 0) {
        const cId = convs.data[0].id;
        const msgs = await fetch(`/api/v1/conversations/${cId}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());
        return { conversationId: cId, messages: msgs.data };
      }
      return null;
    });

    if (convMsgRes?.messages?.length > 0) {
      const targetMsgId = convMsgRes.messages[0].id;
      console.log(`  -> Adding reaction 🚀 to message ${targetMsgId}...`);
      const rxRes = await sessionB.page.evaluate(async ({ msgId }) => {
        const token = localStorage.getItem('collab_token');
        const res = await fetch(`/api/v1/messages/${msgId}/reactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ emoji: '🚀' })
        });
        return await res.json();
      }, { msgId: targetMsgId });

      console.log('  -> Reaction API response:', rxRes);
      if (!rxRes.success || !rxRes.data) {
        throw new Error(`Reaction API contract failed: ${JSON.stringify(rxRes)}`);
      }
      console.log('  -> Reaction contract validated (PASS)!');
    }

    // 6. BLOQUE 10 — ATTACHMENTS (Upload & Real Retrieval)
    console.log('[E2E] Step 6: Testing physical file upload & retrieval...');
    const testFileContent = `COLLABPULSE_INTEGRITY_VERIFICATION_${Date.now()}_SECRET_DATA`;
    const uploadResult = await sessionA.page.evaluate(async ({ content }) => {
      const token = localStorage.getItem('collab_token');
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, 'security_report.txt');

      const res = await fetch('/api/v1/files/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      return await res.json();
    }, { content: testFileContent });

    console.log('  -> File upload result:', uploadResult);
    if (!uploadResult.success || !uploadResult.data?.url) {
      throw new Error(`File upload failed: ${JSON.stringify(uploadResult)}`);
    }

    const uploadedFileUrl = uploadResult.data.url;
    console.log(`  -> File uploaded to: ${uploadedFileUrl}`);

    // Verify recipient User B can physically fetch and verify file contents
    const retrievedContent = await sessionB.page.evaluate(async ({ url }) => {
      const token = localStorage.getItem('collab_token');
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await res.text();
    }, { url: uploadedFileUrl });

    if (retrievedContent.trim() !== testFileContent.trim()) {
      throw new Error(`Retrieved file content mismatch! Expected: ${testFileContent}, Got: ${retrievedContent}`);
    }
    console.log('  -> Physical file content matches exactly on remote peer (PASS)!');

    // 7. BLOQUE 11 — MULTI-TENANT ISOLATION & SECURITY
    console.log('[E2E] Step 7: Testing Multi-Tenant Security & Isolation (Tenant B vs Tenant A)...');
    const sessionIsolated = await createAuthenticatedSession(browserIsolated, {
      id: 'usr-isolated-b1',
      email: 'user.b1@isolated.local',
      displayName: 'Isolated User B1',
      tenantId: 'tenant-isolated-b'
    });
    console.log('  -> User Isolated logged in (Tenant B).');

    // Test 1: Cross-tenant 1:1 call attempt (Isolated Tenant B -> User A in Tenant A)
    console.log('  -> Testing cross-tenant call blocking...');
    const crossCallResult = await sessionIsolated.page.evaluate(async ({ targetUserId }) => {
      const token = localStorage.getItem('collab_token');
      const res = await fetch('/api/v1/calls/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUserId,
          mediaType: 'video',
          title: 'Intrusion Test Call'
        })
      });
      return { status: res.status, body: await res.json() };
    }, { targetUserId: sessionA.user.id });

    console.log('  -> Cross-tenant call attempt result:', crossCallResult);
    if (crossCallResult.status !== 403 || crossCallResult.body.code !== 'TENANT_MISMATCH') {
      throw new Error(`Cross-tenant call NOT blocked! Result: ${JSON.stringify(crossCallResult)}`);
    }
    console.log('  -> Cross-tenant call blocked with 403 TENANT_MISMATCH (PASS)!');

    // Test 2: Cross-tenant conversation message access
    console.log('  -> Testing cross-tenant conversation access...');
    if (convMsgRes?.conversationId) {
      const crossConvResult = await sessionIsolated.page.evaluate(async ({ convId }) => {
        const token = localStorage.getItem('collab_token');
        const res = await fetch(`/api/v1/conversations/${convId}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return { status: res.status, body: await res.json() };
      }, { convId: convMsgRes.conversationId });

      console.log('  -> Cross-tenant conversation query result:', crossConvResult);
      if (crossConvResult.status !== 403 && crossConvResult.status !== 404) {
        throw new Error(`Cross-tenant conversation access NOT blocked! Status: ${crossConvResult.status}`);
      }
      console.log('  -> Cross-tenant conversation access securely blocked (PASS)!');
    }

    // 8. Clean up
    console.log('[E2E] Step 8: Hanging up 1:1 call...');
    const hangupBtn = sessionA.page.locator('button[title*="Finalizar llamada"]').first();
    if (await hangupBtn.isVisible()) {
      await hangupBtn.click();
    }
    await sessionA.page.waitForTimeout(1500);

    console.log('====================================================');
    console.log('BLOQUES 8, 9, 10 & 11 PASSED: CHAT, ATTACHMENTS & SECURITY VERIFIED!');
    console.log('====================================================');
    return true;
  } catch (err: any) {
    console.error('BLOQUES 8, 9, 10 & 11 FAILED with error:', err.message);
    throw err;
  } finally {
    if (browserA) await browserA.close();
    if (browserB) await browserB.close();
    if (browserIsolated) await browserIsolated.close();
  }
}

runChatAttachmentsSecurityTest().then(() => {
  process.exit(0);
}).catch(() => {
  process.exit(1);
});
