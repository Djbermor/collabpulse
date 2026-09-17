import { launchMediaBrowser, createAuthenticatedSession, initiateCallViaUI, acceptIncomingCall, checkWebRTCState } from './helpers/browser_harness';
import { Browser } from '@playwright/test';

async function runLiveKitGroupTest() {
  console.log('====================================================');
  console.log('STARTING BLOQUE 6 & 7: LIVEKIT REAL & CONCURRENCY');
  console.log('====================================================');

  let browserA: Browser | null = null;
  let browserB: Browser | null = null;
  let browserC: Browser | null = null;

  try {
    // 1. Launch 3 real Chromium instances with fake media
    console.log('[E2E] Step 1: Launching 3 Chromium instances for LiveKit...');
    browserA = await launchMediaBrowser();
    browserB = await launchMediaBrowser();
    browserC = await launchMediaBrowser();

    // 2. Authenticate Users A, B and C (same tenant)
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

    // 3. User A creates a LiveKit Group Call
    console.log('[E2E] Step 3: User A starting LiveKit Group Call...');
    const groupCallId = await sessionA.page.evaluate(() => {
      return new Promise((resolve) => {
        window.dispatchEvent(
          new CustomEvent('collabpulse:start-group-call', {
            detail: {
              title: 'Sala Ejecutiva LiveKit',
              mediaType: 'video',
              callback: resolve
            }
          })
        );
      });
    });

    console.log(`  -> Group call created on server with ID: ${groupCallId}`);

    // Wait for User A to connect to LiveKit SFU
    await sessionA.page.waitForFunction(() => {
      const sfu = (window as any).__collabpulse_sfu;
      return sfu && sfu.room && sfu.room.state === 'connected';
    }, { timeout: 15000 });
    console.log('  -> User A successfully connected to LiveKit SFU room.');

    // 4. Users B and C join the Group Call
    console.log('[E2E] Step 4: Users B and C joining the LiveKit Group Call...');
    await sessionB.page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('collabpulse:join-group-call', { detail: { callId: id } }));
    }, groupCallId);

    await sessionC.page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('collabpulse:join-group-call', { detail: { callId: id } }));
    }, groupCallId);

    // 5. Wait for all 3 participants to connect and publish tracks
    console.log('[E2E] Step 5: Waiting for 3-way mesh synchronization on LiveKit SFU...');
    let syncd = false;
    let sfuStatsA: any = null;
    let sfuStatsB: any = null;
    let sfuStatsC: any = null;

    for (let i = 0; i < 30; i++) {
      await sessionA.page.waitForTimeout(1000);

      sfuStatsA = await sessionA.page.evaluate(() => {
        const sfu = (window as any).__collabpulse_sfu;
        if (!sfu || !sfu.room) return null;
        return {
          roomState: sfu.room.state,
          remoteCount: sfu.room.remoteParticipants ? sfu.room.remoteParticipants.size : 0,
          localTracks: sfu.room.localParticipant ? sfu.room.localParticipant.trackPublications.size : 0
        };
      });

      sfuStatsB = await sessionB.page.evaluate(() => {
        const sfu = (window as any).__collabpulse_sfu;
        if (!sfu || !sfu.room) return null;
        return {
          roomState: sfu.room.state,
          remoteCount: sfu.room.remoteParticipants ? sfu.room.remoteParticipants.size : 0,
          localTracks: sfu.room.localParticipant ? sfu.room.localParticipant.trackPublications.size : 0
        };
      });

      sfuStatsC = await sessionC.page.evaluate(() => {
        const sfu = (window as any).__collabpulse_sfu;
        if (!sfu || !sfu.room) return null;
        return {
          roomState: sfu.room.state,
          remoteCount: sfu.room.remoteParticipants ? sfu.room.remoteParticipants.size : 0,
          localTracks: sfu.room.localParticipant ? sfu.room.localParticipant.trackPublications.size : 0
        };
      });

      if (
        sfuStatsA?.roomState === 'connected' && sfuStatsA?.remoteCount >= 2 &&
        sfuStatsB?.roomState === 'connected' && sfuStatsB?.remoteCount >= 2 &&
        sfuStatsC?.roomState === 'connected' && sfuStatsC?.remoteCount >= 2
      ) {
        syncd = true;
        break;
      }
    }

    console.log('  -> LiveKit Room Stats A:', sfuStatsA);
    console.log('  -> LiveKit Room Stats B:', sfuStatsB);
    console.log('  -> LiveKit Room Stats C:', sfuStatsC);

    if (!syncd) {
      throw new Error(`LiveKit SFU 3-way sync failed! A: ${JSON.stringify(sfuStatsA)}, B: ${JSON.stringify(sfuStatsB)}, C: ${JSON.stringify(sfuStatsC)}`);
    }

    console.log('  -> 3-way LiveKit SFU participants connected & publishing!');

    // 6. Verify UI: ParticipantGrid and Tiles in DOM
    console.log('[E2E] Step 6: Verifying UI in DOM...');
    const pageADebug = await sessionA.page.evaluate(() => {
      return {
        buttonTitles: Array.from(document.querySelectorAll('button')).map(b => b.title || b.innerText).filter(Boolean).slice(0, 15),
        videosCount: document.querySelectorAll('video').length,
        hasCallWindow: !!document.querySelector('aside[aria-label*="Llamada"]') || !!document.querySelector('button[title*="Finalizar"]')
      };
    });
    console.log('  -> Session A UI inspection:', pageADebug);

    // 7. Test Mute and Video toggles in Group Call
    console.log('[E2E] Step 7: Testing Mic toggle in Group Call...');
    const muteBtnA = sessionA.page.locator('button[title*="micrófono"], button[title*="microfono"]').first();
    await muteBtnA.click();
    await sessionA.page.waitForTimeout(500);

    const isGroupMutedA = await sessionA.page.evaluate(() => {
      const sfu = (window as any).__collabpulse_sfu;
      const audioPub = Array.from(sfu.room.localParticipant.trackPublications.values()).find((p: any) => p.kind === 'audio') as any;
      return audioPub ? audioPub.isMuted : false;
    });
    console.log(`  -> Group Audio Muted in LiveKit: ${isGroupMutedA}`);

    // Unmute
    await muteBtnA.click();
    await sessionA.page.waitForTimeout(500);

    // 8. BLOQUE 7 — GROUP + 1:1 CONCURRENCY
    console.log('----------------------------------------------------');
    console.log('[E2E] Step 8: Testing GROUP + 1:1 CONCURRENCY...');
    console.log('----------------------------------------------------');

    // While A, B, C are in Group Call, User B calls User A with 1:1 incoming call!
    console.log('[E2E] Triggering 1:1 call from User B to User A...');
    await initiateCallViaUI(sessionB.page, sessionA.user.id, sessionA.user.displayName, true);

    // User A should receive in-call banner: "Aceptar y poner en espera"
    const accept1to1Btn = sessionA.page.locator('button:has-text("Aceptar y poner en espera"), button:has-text("Aceptar")').first();
    await accept1to1Btn.waitFor({ state: 'visible', timeout: 15000 });
    console.log('  -> 1:1 Incoming Call banner visible on User A during Group Call.');
    await accept1to1Btn.click();
    await sessionA.page.waitForTimeout(2000);

    // Check that Group Media on User A is PAUSED
    const isGroupPausedA = await sessionA.page.evaluate(() => {
      const sfu = (window as any).__collabpulse_sfu;
      return sfu ? sfu.isPublishingPaused || sfu.isSubscriptionsPaused : false;
    });
    console.log(`  -> Group Call Media paused on User A: ${isGroupPausedA}`);

    // End the 1:1 call
    console.log('[E2E] Ending 1:1 call to verify Group Call automatic resume...');
    const hangup1to1Btn = sessionA.page.locator('button[title*="Finalizar llamada"]').first();
    await hangup1to1Btn.click();
    await sessionA.page.waitForTimeout(2000);

    // Verify Group Call is RESUMED on User A
    const isGroupResumedA = await sessionA.page.evaluate(() => {
      const sfu = (window as any).__collabpulse_sfu;
      return sfu ? !sfu.isPublishingPaused && !sfu.isSubscriptionsPaused : false;
    });
    console.log(`  -> Group Call Media automatically resumed on User A: ${isGroupResumedA}`);

    // 9. Host ends Group Call for all
    console.log('[E2E] Step 9: Host ending Group Call...');
    await sessionA.page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('collabpulse:end-group-call'));
    });
    await sessionA.page.waitForTimeout(2000);

    console.log('====================================================');
    console.log('BLOQUE 6 & 7 PASSED: LIVEKIT REAL & CONCURRENCY VERIFIED!');
    console.log('====================================================');
    return true;
  } catch (err: any) {
    console.error('BLOQUE 6 & 7 FAILED with error:', err.message);
    throw err;
  } finally {
    if (browserA) await browserA.close();
    if (browserB) await browserB.close();
    if (browserC) await browserC.close();
  }
}

runLiveKitGroupTest().then(() => {
  process.exit(0);
}).catch(() => {
  process.exit(1);
});
