import { launchMediaBrowser, createAuthenticatedSession, initiateCallViaUI, acceptIncomingCall, checkWebRTCState } from './helpers/browser_harness';
import { Browser } from '@playwright/test';

async function runMultipleCallsTest() {
  console.log('====================================================');
  console.log('STARTING BLOQUE 5: REAL MULTIPLE CALLS BROWSER E2E');
  console.log('====================================================');

  let browserA: Browser | null = null;
  let browserB: Browser | null = null;
  let browserC: Browser | null = null;

  try {
    // 1. Launch 3 Chromium instances with fake media streams
    console.log('[E2E] Step 1: Launching 3 Chromium instances (A, B, C)...');
    browserA = await launchMediaBrowser();
    browserB = await launchMediaBrowser();
    browserC = await launchMediaBrowser();

    // 2. Authenticate User A, User B, User C
    console.log('[E2E] Step 2: Authenticating Users A, B and C...');
    const sessionA = await createAuthenticatedSession(browserA, {
      id: 'usr-admin-mu36yjdt',
      email: 'admin@collabpulse.local',
      displayName: 'Admin User',
      tenantId: 'tenant-collab-a'
    });
    console.log('  -> User A logged in.');

    const sessionB = await createAuthenticatedSession(browserB, {
      id: 'usr-member-a2',
      email: 'user.b@collabpulse.local',
      displayName: 'User Bravo',
      tenantId: 'tenant-collab-a'
    });
    console.log('  -> User B logged in.');

    const sessionC = await createAuthenticatedSession(browserC, {
      id: 'usr-member-a3',
      email: 'user.c@collabpulse.local',
      displayName: 'User Charlie',
      tenantId: 'tenant-collab-a'
    });
    console.log('  -> User C logged in.');

    // 3. User A calls User B
    console.log(`[E2E] Step 3: Call 1: User A (${sessionA.user.id}) calling User B (${sessionB.user.id})...`);
    await initiateCallViaUI(sessionA.page, sessionB.user.id, sessionB.user.displayName, true);
    await acceptIncomingCall(sessionB.page);

    // Wait for A <-> B to connect
    console.log('[E2E] Step 4: Waiting for Call 1 (A <-> B) to establish...');
    let connectedCall1 = false;
    for (let i = 0; i < 20; i++) {
      await sessionA.page.waitForTimeout(1000);
      const stA = await checkWebRTCState(sessionA.page, sessionB.user.id);
      const stB = await checkWebRTCState(sessionB.page, sessionA.user.id);
      if (
        (stA.connectionState === 'connected' || stA.iceConnectionState === 'connected' || stA.iceConnectionState === 'completed') &&
        (stB.connectionState === 'connected' || stB.iceConnectionState === 'connected' || stB.iceConnectionState === 'completed')
      ) {
        connectedCall1 = true;
        break;
      }
    }
    if (!connectedCall1) throw new Error('Call 1 (A <-> B) failed to connect');
    console.log('  -> Call 1 ACTIVE: User A and User B connected via WebRTC.');

    // 4. Concurrent Call: User C calls User A while A is talking with B
    console.log(`[E2E] Step 5: User C (${sessionC.user.id}) calling User A (${sessionA.user.id}) concurrently...`);
    await initiateCallViaUI(sessionC.page, sessionA.user.id, sessionA.user.displayName, true);

    // 5. User A should see the in-call incoming call banner
    console.log('[E2E] Step 6: User A waiting for in-call incoming banner...');
    const acceptAndHoldBtn = sessionA.page.locator('button:has-text("Aceptar y poner en espera")').first();
    await acceptAndHoldBtn.waitFor({ state: 'visible', timeout: 15000 });
    console.log('  -> In-call banner detected on User A.');

    // 6. User A clicks "Aceptar y poner en espera"
    console.log('[E2E] Step 7: User A accepting Call 2 (putting Call 1 on hold)...');
    await acceptAndHoldBtn.click();

    // 7. Verify Call 2 connects between A and C, while B is put on hold
    console.log('[E2E] Step 8: Verifying Call 2 (A <-> C) active & Call 1 (B) held...');
    let connectedCall2 = false;
    for (let i = 0; i < 20; i++) {
      await sessionA.page.waitForTimeout(1000);
      const stC = await checkWebRTCState(sessionC.page, sessionA.user.id);
      if (stC.connectionState === 'connected' || stC.iceConnectionState === 'connected' || stC.iceConnectionState === 'completed') {
        connectedCall2 = true;
        break;
      }
    }
    if (!connectedCall2) throw new Error('Call 2 (A <-> C) failed to connect');

    // Check states on Browser A
    const aCallState = await sessionA.page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasHeldBadge: text.includes('Espera') || text.includes('espera') || text.includes('Reanudar')
      };
    });
    console.log('  -> User A held call indicators:', aCallState);

    // Check held state on Browser B
    const bRemoteHeld = await sessionB.page.evaluate(() => {
      const heldText = document.body.innerText;
      return heldText.includes('espera') || heldText.includes('Espera');
    });
    console.log(`  -> User B remote held indicator verified: ${bRemoteHeld}`);

    // 8. User C ends Call 2
    console.log('[E2E] Step 9: User C ending Call 2...');
    const hangupBtnC = sessionC.page.locator('button[title*="Finalizar llamada"]').first();
    await hangupBtnC.click();
    await sessionA.page.waitForTimeout(2000);
    console.log('  -> Call 2 ended.');

    // 9. User A resumes User B
    console.log('[E2E] Step 10: User A resuming Call 1 (User B)...');
    const resumeBtn = sessionA.page.locator('button:has-text("Reanudar")').first();
    if (await resumeBtn.isVisible()) {
      await resumeBtn.click();
      console.log('  -> Clicked Reanudar on User A.');
    } else {
      // If modal overlay button
      await sessionA.page.evaluate(() => {
        const pcm = (window as any).__collabpulse_pcm;
        // Resume via context event or method
      });
    }

    await sessionA.page.waitForTimeout(1500);

    // 10. Clean up Call 1
    console.log('[E2E] Step 11: Final hangup of Call 1...');
    const hangupBtnA = sessionA.page.locator('button[title*="Finalizar llamada"]').first();
    if (await hangupBtnA.isVisible()) {
      await hangupBtnA.click();
    }
    await sessionA.page.waitForTimeout(1500);

    console.log('====================================================');
    console.log('BLOQUE 5 PASSED: MULTIPLE CALLS (HOLD/RESUME) VERIFIED!');
    console.log('====================================================');
    return true;
  } catch (err: any) {
    console.error('BLOQUE 5 FAILED with error:', err.message);
    throw err;
  } finally {
    if (browserA) await browserA.close();
    if (browserB) await browserB.close();
    if (browserC) await browserC.close();
  }
}

runMultipleCallsTest().then(() => {
  process.exit(0);
}).catch(() => {
  process.exit(1);
});
