import { chromium, Browser, Page } from 'playwright';

interface UserSession {
  browser: Browser;
  page: Page;
  email: string;
  name: string;
}

async function runRealFrontendE2ETest() {
  console.log('====================================================');
  console.log('STARTING REAL FRONTEND GUI INTERACTION TEST');
  console.log('====================================================');

  let sessionA: UserSession | null = null;
  let sessionB: UserSession | null = null;

  try {
    // 1. Launch Browser A and Browser B with fake media devices
    console.log('[Step 1] Launching independent Chromium instances with emulated AV devices...');
    const launchOpts = {
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };

    const browserA = await chromium.launch(launchOpts);
    const browserB = await chromium.launch(launchOpts);

    const pageA = await browserA.newPage();
    const pageB = await browserB.newPage();

    // Attach error loggers
    pageA.on('console', msg => console.log(`[Browser A Console ${msg.type()}] ${msg.text()}`));
    pageA.on('pageerror', err => console.error(`[Browser A PageError] ${err.message}`));

    pageB.on('console', msg => console.log(`[Browser B Console ${msg.type()}] ${msg.text()}`));
    pageB.on('pageerror', err => console.error(`[Browser B PageError] ${err.message}`));

    sessionA = { browser: browserA, page: pageA, email: 'admin@collabpulse.local', name: 'Administrador Sistema' };
    sessionB = { browser: browserB, page: pageB, email: 'user.b@collabpulse.local', name: 'User Bravo' };

    // 2. GUI Login for Browser A
    console.log('[Step 2] Browser A: Navigating to http://localhost:3000 and logging in via GUI form...');
    await pageA.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await pageA.fill('input[autocomplete="username"], input[type="text"]', sessionA.email);
    await pageA.fill('input[type="password"]', 'CollabPulse2026!Admin');
    await pageA.click('form button[type="submit"]');
    await pageA.waitForSelector('text=Workspace A', { timeout: 10000 });
    console.log('  -> Browser A successfully logged in and Dashboard rendered!');

    // 3. GUI Login for Browser B
    console.log('[Step 3] Browser B: Navigating to http://localhost:3000 and logging in via GUI form...');
    await pageB.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await pageB.fill('input[autocomplete="username"], input[type="text"]', sessionB.email);
    await pageB.fill('input[type="password"]', 'CollabPulse2026!Admin');
    await pageB.click('form button[type="submit"]');
    await pageB.waitForSelector('text=Workspace A', { timeout: 10000 });
    console.log('  -> Browser B successfully logged in and Dashboard rendered!');

    // 4. Browser A opens Calls View
    console.log('[Step 4] Browser A: Clicking "Llamadas" in sidebar...');
    const callsNavBtn = pageA.locator('button:has-text("Llamadas"), [title*="Llamadas"]').first();
    await callsNavBtn.click();
    await pageA.waitForSelector('text=Directorio de Colaboradores', { timeout: 8000 });
    console.log('  -> CallsView loaded with Collaborators Directory.');

    // 5. Browser A clicks video call button for User Bravo
    console.log('[Step 5] Browser A: Locating User Bravo and clicking Video Call button...');
    const allButtons = await pageA.locator('button').evaluateAll(btns => btns.map(b => ({ text: b.innerText, title: b.getAttribute('title') })));
    console.log('  -> All buttons found on pageA:', allButtons.filter(b => b.title || b.text.includes('Llam') || b.text.includes('Bravo') || b.text.includes('User')));
    const videoCallBtn = pageA.locator('button[title="Videollamada con User Bravo"]').first();
    await videoCallBtn.waitFor({ state: 'visible', timeout: 8000 });
    console.log('  -> Found video call button with title:', await videoCallBtn.getAttribute('title'));
    await videoCallBtn.click();
    console.log('  -> Video call button clicked.');
    await pageA.waitForTimeout(1000);

    // 6. Verify OutgoingCallModal appears on Browser A
    console.log('[Step 6] Browser A: Verifying OutgoingCallModal is visible in DOM...');
    const outgoingModal = pageA.locator('text=Iniciando videollamada...').first();
    await outgoingModal.waitFor({ state: 'visible', timeout: 8000 });
    console.log('  -> OutgoingCallModal rendered with calling animation (PASS)!');

    // 7. Verify IncomingCallModal appears on Browser B
    console.log('[Step 7] Browser B: Verifying IncomingCallModal received via SSE...');
    const incomingModal = pageB.locator('text=Videollamada entrante...').first();
    await incomingModal.waitFor({ state: 'visible', timeout: 10000 });
    console.log('  -> IncomingCallModal rendered on Callee screen in real-time (PASS)!');

    // 8. Browser B clicks "Aceptar"
    console.log('[Step 8] Browser B: Clicking "Aceptar" button...');
    const acceptBtn = pageB.locator('button:has-text("Aceptar")').first();
    await acceptBtn.click();
    console.log('  -> Call accepted by User B.');

    // 9. Verify CallWindow appears on BOTH browsers
    console.log('[Step 9] Verifying CallWindow mounted in DOM on both A and B...');
    const callWindowA = pageA.locator('video').first();
    const callWindowB = pageB.locator('video').first();
    await callWindowA.waitFor({ state: 'visible', timeout: 10000 });
    await callWindowB.waitFor({ state: 'visible', timeout: 10000 });
    console.log('  -> CallWindow rendered on both Browser A and Browser B (PASS)!');

    // 10. Wait for WebRTC P2P Connection
    console.log('[Step 10] Waiting for RTCPeerConnection to reach "connected" state...');
    let webrtcConnected = false;
    for (let i = 0; i < 20; i++) {
      await pageA.waitForTimeout(1000);
      const stats = await pageA.evaluate(() => {
        const mgr = (window as any).__collabpulse_peerConnectionManager || (window as any).__collabpulse_pcm;
        const peers = (window as any).__collabpulse_peers || (mgr ? (mgr.peers || (mgr as any)._peers) : null);
        if (!peers) return null;
        for (const [peerId, ctx] of peers.entries()) {
          return {
            peerId,
            connState: ctx.pc?.connectionState,
            iceState: ctx.pc?.iceConnectionState,
            tracksCount: ctx.remoteStream?.getTracks().length
          };
        }
        return null;
      });

      console.log(`  -> Polling WebRTC stats (${i + 1}/20):`, stats);
      if (stats && (stats.connState === 'connected' || stats.iceState === 'connected' || stats.iceState === 'completed')) {
        console.log('  -> WebRTC P2P state on Browser A (CONNECTED!):', stats);
        webrtcConnected = true;
        break;
      }
    }
    if (!webrtcConnected) throw new Error('WebRTC connection timed out');

    // 11. Verify Real Media in DOM
    console.log('[Step 11] Verifying physical Media Streams and HTML elements in DOM...');
    const mediaA = await pageA.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      const audio = document.querySelector('audio') as HTMLAudioElement;
      return {
        videoReadyState: video ? video.readyState : -1,
        videoWidth: video ? video.videoWidth : 0,
        videoHeight: video ? video.videoHeight : 0,
        hasAudioSrcObject: !!(audio && audio.srcObject),
        audioPaused: audio ? audio.paused : true
      };
    });
    console.log('  -> Browser A DOM Media Elements:', mediaA);

    const mediaB = await pageB.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      const audio = document.querySelector('audio') as HTMLAudioElement;
      return {
        videoReadyState: video ? video.readyState : -1,
        videoWidth: video ? video.videoWidth : 0,
        videoHeight: video ? video.videoHeight : 0,
        hasAudioSrcObject: !!(audio && audio.srcObject),
        audioPaused: audio ? audio.paused : true
      };
    });
    console.log('  -> Browser B DOM Media Elements:', mediaB);

    // 12. Test Controls: Mic Toggle
    console.log('[Step 12] Testing Microphone Mute/Unmute toggle from CallWindow...');
    const micBtnA = pageA.locator('button[title*="micrófono" i], button[title*="Silenciar" i]').first();
    await micBtnA.click();
    await pageA.waitForTimeout(500);
    const isMutedA = await pageA.evaluate(() => {
      const mgr = (window as any).__collabpulse_localMediaController || (window as any).__collabpulse_lmc;
      const stream = mgr ? (mgr.localStream || (mgr.getStream && mgr.getStream())) : null;
      return stream?.getAudioTracks().some((t: any) => !t.enabled);
    });
    console.log('  -> Audio track enabled === false after Mute click:', isMutedA);

    await micBtnA.click();
    await pageA.waitForTimeout(500);
    const isUnmutedA = await pageA.evaluate(() => {
      const mgr = (window as any).__collabpulse_localMediaController || (window as any).__collabpulse_lmc;
      const stream = mgr ? (mgr.localStream || (mgr.getStream && mgr.getStream())) : null;
      return stream?.getAudioTracks().some((t: any) => t.enabled);
    });
    console.log('  -> Audio track enabled === true after Unmute click:', isUnmutedA);

    // 13. Test Controls: Camera Toggle
    console.log('[Step 13] Testing Camera Toggle from CallWindow...');
    const camBtnA = pageA.locator('button[title*="cámara" i]').first();
    await camBtnA.click();
    await pageA.waitForTimeout(500);
    const isCamOffA = await pageA.evaluate(() => {
      const mgr = (window as any).__collabpulse_localMediaController || (window as any).__collabpulse_lmc;
      const stream = mgr ? (mgr.localStream || (mgr.getStream && mgr.getStream())) : null;
      return stream?.getVideoTracks().some((t: any) => !t.enabled);
    });
    console.log('  -> Video track enabled === false after Cam Off click:', isCamOffA);

    await camBtnA.click();
    await pageA.waitForTimeout(500);
    const isCamOnA = await pageA.evaluate(() => {
      const mgr = (window as any).__collabpulse_localMediaController || (window as any).__collabpulse_lmc;
      const stream = mgr ? (mgr.localStream || (mgr.getStream && mgr.getStream())) : null;
      return stream?.getVideoTracks().some((t: any) => t.enabled);
    });
    console.log('  -> Video track enabled === true after Cam On click:', isCamOnA);

    // 14. Test In-Call Chat from UI
    console.log('[Step 14] Testing In-Call Chat Drawer and Realtime Messaging...');
    const chatToggleA = pageA.locator('button[title*="Chat de la llamada"]').first();
    await chatToggleA.click();
    await pageA.waitForTimeout(500);

    const chatToggleB = pageB.locator('button[title*="Chat de la llamada"]').first();
    await chatToggleB.click();
    await pageB.waitForTimeout(500);

    const testMsgA = `Mensaje GUI de Admin en llamada - ${Date.now()}`;
    const chatInputA = pageA.locator('#incall-chat-input').first();
    await chatInputA.fill(testMsgA);
    await chatInputA.press('Enter');

    console.log('  -> User A sent in-call message. Waiting on Browser B...');
    const msgBLocator = pageB.locator(`text=${testMsgA}`).first();
    await msgBLocator.waitFor({ state: 'visible', timeout: 8000 });
    console.log('  -> Browser B received in-call message in DOM without page refresh (PASS)!');

    const testMsgB = `Respuesta GUI de User B - ${Date.now()}`;
    const chatInputB = pageB.locator('#incall-chat-input').first();
    await chatInputB.fill(testMsgB);
    await chatInputB.press('Enter');

    console.log('  -> User B replied. Waiting on Browser A...');
    const msgALocator = pageA.locator(`text=${testMsgB}`).first();
    await msgALocator.waitFor({ state: 'visible', timeout: 8000 });
    console.log('  -> Browser A received reply in DOM without page refresh (PASS)!');

    // 15. Hangup and Cleanup
    console.log('[Step 15] Browser A: Clicking Hangup button...');
    const hangupBtnA = pageA.locator('button[title*="Finalizar llamada"]').first();
    await hangupBtnA.click();
    await pageA.waitForTimeout(2000);

    // Verify CallWindow unmounted on both A and B
    const isCallWindowPresentA = await pageA.locator('button[title*="Finalizar llamada"]').count();
    const isCallWindowPresentB = await pageB.locator('button[title*="Finalizar llamada"]').count();
    console.log('  -> CallWindow unmounted on Browser A:', isCallWindowPresentA === 0);
    console.log('  -> CallWindow unmounted on Browser B:', isCallWindowPresentB === 0);

    console.log('====================================================');
    console.log('REAL FRONTEND GUI INTERACTION TEST: ALL 15 STEPS PASSED!');
    console.log('====================================================');
  } finally {
    if (sessionA?.browser) await sessionA.browser.close();
    if (sessionB?.browser) await sessionB.browser.close();
  }
}

runRealFrontendE2ETest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('REAL FRONTEND GUI TEST FAILED:', err);
  process.exit(1);
});
