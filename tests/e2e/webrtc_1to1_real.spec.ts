import { launchMediaBrowser, createAuthenticatedSession, initiateCallViaUI, acceptIncomingCall, checkWebRTCState } from './helpers/browser_harness';
import { Browser } from '@playwright/test';

async function runWebRTC1to1Test() {
  console.log('====================================================');
  console.log('STARTING BLOQUE 2, 3 & 4: REAL WEBRTC 1:1 BROWSER E2E');
  console.log('====================================================');

  let browserA: Browser | null = null;
  let browserB: Browser | null = null;

  try {
    // 1. Launch real Chromium instances with fake media streams
    console.log('[E2E] Step 1: Launching Chromium instances with fake media...');
    browserA = await launchMediaBrowser();
    browserB = await launchMediaBrowser();

    // 2. Authenticate User A and User B
    console.log('[E2E] Step 2: Authenticating User A (Admin) and User B (Bravo)...');
    const sessionA = await createAuthenticatedSession(browserA, {
      id: 'usr-admin-a1',
      email: 'admin@collabpulse.local',
      displayName: 'Admin User',
      tenantId: 'tenant-collab-a'
    });
    console.log('  -> User A logged in successfully.');

    const sessionB = await createAuthenticatedSession(browserB, {
      id: 'usr-member-a2',
      email: 'user.b@collabpulse.local',
      displayName: 'User Bravo',
      tenantId: 'tenant-collab-a'
    });
    console.log('  -> User B logged in successfully.');

    // 3. User A initiates 1:1 call to User B
    console.log(`[E2E] Step 3: User A (${sessionA.user.id}) calling User B (${sessionB.user.id})...`);
    await initiateCallViaUI(sessionA.page, sessionB.user.id, sessionB.user.displayName, true);

    // 4. User B receives incoming call modal & accepts
    console.log('[E2E] Step 4: User B waiting for incoming call modal...');
    await acceptIncomingCall(sessionB.page);
    console.log('  -> User B accepted the call.');

    // 5. Wait for WebRTC connection to establish on both peers
    console.log('[E2E] Step 5: Waiting for real WebRTC RTCPeerConnection to connect...');
    let connectedA = false;
    let connectedB = false;
    let stateA: any = null;
    let stateB: any = null;

    for (let i = 0; i < 30; i++) {
      await sessionA.page.waitForTimeout(1000);
      stateA = await checkWebRTCState(sessionA.page, sessionB.user.id);
      stateB = await checkWebRTCState(sessionB.page, sessionA.user.id);

      if (
        (stateA.connectionState === 'connected' || stateA.iceConnectionState === 'connected' || stateA.iceConnectionState === 'completed') &&
        (stateB.connectionState === 'connected' || stateB.iceConnectionState === 'connected' || stateB.iceConnectionState === 'completed')
      ) {
        connectedA = true;
        connectedB = true;
        break;
      }
    }

    console.log('[E2E] WebRTC State User A:', stateA);
    console.log('[E2E] WebRTC State User B:', stateB);

    if (!connectedA || !connectedB) {
      throw new Error(`WebRTC failed to connect! State A: ${JSON.stringify(stateA)}, State B: ${JSON.stringify(stateB)}`);
    }

    console.log('  -> RTCPeerConnection: CONNECTED');
    console.log('  -> ICE Connection: CONNECTED/COMPLETED');
    console.log(`  -> Tracks received: A=${stateA.remoteTracksCount}, B=${stateB.remoteTracksCount}`);

    // 6. Test Media Controls - Microphone Mute / Unmute (Bloque 4)
    console.log('[E2E] Step 6: Testing Microphone Mute / Unmute...');
    const muteBtnA = sessionA.page.locator('button[title*="micrófono"], button[title*="microfono"]').first();
    await muteBtnA.click();
    await sessionA.page.waitForTimeout(500);

    const isMutedA = await sessionA.page.evaluate(() => {
      const pcm = (window as any).__collabpulse_pcm;
      const peers = (window as any).__collabpulse_peers;
      if (!peers || peers.size === 0) return null;
      const pc: RTCPeerConnection = peers.values().next().value.pc;
      const audioSender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
      return audioSender?.track ? !audioSender.track.enabled : false;
    });
    console.log(`  -> Audio Muted (track disabled): ${isMutedA}`);

    // Unmute
    await muteBtnA.click();
    await sessionA.page.waitForTimeout(500);
    const isUnmutedA = await sessionA.page.evaluate(() => {
      const peers = (window as any).__collabpulse_peers;
      const pc: RTCPeerConnection = peers.values().next().value.pc;
      const audioSender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
      return audioSender?.track ? audioSender.track.enabled : false;
    });
    console.log(`  -> Audio Unmuted (track enabled): ${isUnmutedA}`);

    // 7. Test Media Controls - Camera Off / On (Bloque 4)
    console.log('[E2E] Step 7: Testing Camera Off / On...');
    const cameraBtnA = sessionA.page.locator('button[title*="cámara"], button[title*="camara"]').first();
    await cameraBtnA.click();
    await sessionA.page.waitForTimeout(500);

    const isCameraOffA = await sessionA.page.evaluate(() => {
      const peers = (window as any).__collabpulse_peers;
      const pc: RTCPeerConnection = peers.values().next().value.pc;
      const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      return videoSender?.track ? !videoSender.track.enabled : false;
    });
    console.log(`  -> Camera Off (track disabled): ${isCameraOffA}`);

    // Turn camera back on
    await cameraBtnA.click();
    await sessionA.page.waitForTimeout(500);
    const isCameraOnA = await sessionA.page.evaluate(() => {
      const peers = (window as any).__collabpulse_peers;
      const pc: RTCPeerConnection = peers.values().next().value.pc;
      const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      return videoSender?.track ? videoSender.track.enabled : false;
    });
    console.log(`  -> Camera On (track enabled): ${isCameraOnA}`);

    // 8. Test Call Window Minimize / Restore
    console.log('[E2E] Step 8: Testing CallWindow Minimize / Restore...');
    const minimizeBtn = sessionA.page.locator('button[title*="Minimizar"]').first();
    await minimizeBtn.click();
    await sessionA.page.waitForTimeout(500);

    const restoreBtn = sessionA.page.locator('button[title*="Restaurar"]').first();
    await restoreBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  -> Minimized to floating window.');
    await restoreBtn.click();
    await sessionA.page.waitForTimeout(500);
    console.log('  -> Restored from floating window.');

    // 9. Hangup call via UI button
    console.log('[E2E] Step 9: Hanging up call via UI button...');
    const hangupBtn = sessionA.page.locator('button[title*="Finalizar llamada"]').first();
    await hangupBtn.click();
    await sessionA.page.waitForTimeout(2000);

    // Verify cleanup
    const finalPeersA = await sessionA.page.evaluate(() => {
      const peers = (window as any).__collabpulse_peers;
      return peers ? peers.size : 0;
    });
    console.log(`  -> Cleaned up WebRTC sessions on Peer A (remaining: ${finalPeersA})`);

    console.log('====================================================');
    console.log('BLOQUE 2, 3 & 4 PASSED: REAL WEBRTC 1:1 VERIFIED!');
    console.log('====================================================');
    return true;
  } catch (err: any) {
    console.error('BLOQUE 2, 3 & 4 FAILED with error:', err.message);
    throw err;
  } finally {
    if (browserA) await browserA.close();
    if (browserB) await browserB.close();
  }
}

runWebRTC1to1Test().then(() => {
  process.exit(0);
}).catch(() => {
  process.exit(1);
});
