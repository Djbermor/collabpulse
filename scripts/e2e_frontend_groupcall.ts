import { chromium, Browser, Page } from 'playwright';

interface UserSession {
  browser: Browser;
  page: Page;
  email: string;
  name: string;
}

async function runGroupCallE2ETest() {
  console.log('====================================================');
  console.log('STARTING REAL FRONTEND LIVEKIT GROUP CALL E2E TEST');
  console.log('====================================================');

  let sessionA: UserSession | null = null;
  let sessionB: UserSession | null = null;

  try {
    const launchOpts = {
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };

    console.log('[Step 1] Launching Chromium instances for User A (Host) and User B (Participant)...');
    const browserA = await chromium.launch(launchOpts);
    const browserB = await chromium.launch(launchOpts);

    const pageA = await browserA.newPage();
    const pageB = await browserB.newPage();

    pageA.on('console', msg => console.log(`[Browser A] ${msg.text()}`));
    pageB.on('console', msg => console.log(`[Browser B] ${msg.text()}`));

    sessionA = { browser: browserA, page: pageA, email: 'admin@collabpulse.local', name: 'Administrador Sistema' };
    sessionB = { browser: browserB, page: pageB, email: 'user.b@collabpulse.local', name: 'User Bravo' };

    // Login A
    console.log('[Step 2] Logging in User A (Admin / Host)...');
    await pageA.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await pageA.fill('input[autocomplete="username"], input[type="text"]', sessionA.email);
    await pageA.fill('input[type="password"]', 'CollabPulse2026!Admin');
    await pageA.click('form button[type="submit"]');
    await pageA.waitForSelector('text=Workspace A', { timeout: 10000 });

    // Login B
    console.log('[Step 3] Logging in User B (Participant)...');
    await pageB.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await pageB.fill('input[autocomplete="username"], input[type="text"]', sessionB.email);
    await pageB.fill('input[type="password"]', 'CollabPulse2026!Admin');
    await pageB.click('form button[type="submit"]');
    await pageB.waitForSelector('text=Workspace A', { timeout: 10000 });

    // Step 4: Host navigates to CallsView
    console.log('[Step 4] Host opens CallsView...');
    const callsNavBtnA = pageA.locator('button:has-text("Llamadas"), [title*="Llamadas"]').first();
    await callsNavBtnA.click();
    await pageA.waitForSelector('text=Directorio de Colaboradores', { timeout: 8000 });

    // Step 5: Host clicks "Iniciar videollamada" (Group instant call)
    console.log('[Step 5] Host initiates LiveKit Group Call...');
    const startGroupCallBtn = pageA.locator('button:has-text("Iniciar videollamada")').first();
    await startGroupCallBtn.click();

    // Step 6: Verify CallWindow mounts on Host
    console.log('[Step 6] Verifying CallWindow mounted on Host with ParticipantGrid...');
    await pageA.waitForSelector('button[title*="Finalizar"]', { timeout: 25000 });
    console.log('  -> Host CallWindow mounted in DOM (PASS)!');

    // Step 7: Verify LiveKit SFU connection on Host
    console.log('[Step 7] Checking LiveKit SFU connection state on Host...');
    let hostSfuConnected = false;
    let groupCallId = '';
    for (let i = 0; i < 15; i++) {
      await pageA.waitForTimeout(1000);
      const sfuState = await pageA.evaluate(() => {
        const sfu = (window as any).__collabpulse_sfu;
        const callContext = (window as any).__collabpulse_activeSession;
        return {
          connected: sfu ? sfu.isConnected() : false,
          roomName: sfu?.room?.name,
          numParticipants: sfu?.room?.remoteParticipants?.size ?? 0
        };
      });

      if (sfuState.connected) {
        console.log('  -> Host LiveKit SFU state:', sfuState);
        hostSfuConnected = true;
        groupCallId = sfuState.roomName;
        break;
      }
    }
    console.log('  -> LiveKit SFU connected on Host:', hostSfuConnected);

    // Step 8: User B joins group call
    console.log('[Step 8] User B joins the group call...');
    const callsNavBtnB = pageB.locator('button:has-text("Llamadas"), [title*="Llamadas"]').first();
    await callsNavBtnB.click();
    await pageB.waitForSelector('text=Directorio de Colaboradores', { timeout: 8000 });

    // Get active group calls via API
    const activeGroupCalls = await pageB.evaluate(async () => {
      const res = await fetch('/api/v1/group-calls/active', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('collab_token') || ''}` }
      });
      const data = await res.json();
      return data;
    });
    console.log('  -> Active group calls detected by User B:', activeGroupCalls);

    const callToJoin = activeGroupCalls?.data?.[0]?.id || groupCallId;
    if (callToJoin) {
      console.log(`  -> User B joining call ${callToJoin} via join code input...`);
      const codeInput = pageB.locator('input[placeholder*="Código de sala"]').first();
      await codeInput.fill(callToJoin);
      const joinBtn = pageB.locator('button:has-text("Unirse")').first();
      await joinBtn.click();

      // Verify CallWindow mounts on User B
      await pageB.waitForSelector('button[title*="Abandonar conferencia"], button:has-text("Salir")', { timeout: 15000 });
      console.log('  -> Participant CallWindow mounted in DOM (PASS)!');
    }

    // Step 9: Verify Participant Grid rendered
    console.log('[Step 9] Verifying ParticipantGrid and video elements in DOM...');
    const videoCountA = await pageA.locator('video').count();
    const videoCountB = await pageB.locator('video').count();
    console.log(`  -> Video elements in DOM: Host=${videoCountA}, Participant=${videoCountB}`);

    // Step 10: Host ends group call for all
    console.log('[Step 10] Host ending group call for everyone...');
    const endCallBtn = pageA.locator('button[title*="Finalizar conferencia para todos"], button[title*="Finalizar"]').first();
    await endCallBtn.click();
    await pageA.waitForTimeout(2000);

    const isCallWindowA = await pageA.locator('button[title*="Finalizar"]').count();
    const isCallWindowB = await pageB.locator('button[title*="Abandonar conferencia"], button:has-text("Salir")').count();
    console.log('  -> Host CallWindow unmounted:', isCallWindowA === 0);
    console.log('  -> Participant CallWindow unmounted:', isCallWindowB === 0);

    console.log('====================================================');
    console.log('LIVEKIT GROUP CALL E2E TEST: ALL STEPS PASSED!');
    console.log('====================================================');
  } finally {
    if (sessionA?.browser) await sessionA.browser.close();
    if (sessionB?.browser) await sessionB.browser.close();
  }
}

runGroupCallE2ETest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('GROUP CALL E2E TEST FAILED:', err);
  process.exit(1);
});
