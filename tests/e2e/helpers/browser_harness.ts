import { chromium, Browser, BrowserContext, Page } from '@playwright/test';

export interface TestSession {
  context: BrowserContext;
  page: Page;
  user: {
    id: string;
    email: string;
    displayName: string;
    tenantId: string;
  };
}

export async function launchMediaBrowser(): Promise<Browser> {
  return await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--allow-file-access-from-files'
    ]
  });
}

export async function createAuthenticatedSession(
  browser: Browser,
  user: { email: string; password?: string; id: string; displayName: string; tenantId: string },
  baseUrl: string = 'http://localhost:3000'
): Promise<TestSession> {
  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  // Navigate to login screen
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Use UI login form
  const emailInput = page.locator('input[type="text"], input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(user.email);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(user.password || 'CollabPulse2026!Admin');

  const submitButton = page.locator('button[type="submit"]:has-text("Ingresar"), button:has-text("Ingresar")').first();
  await submitButton.click();

  // Wait for session to be established in localStorage and main UI to load
  await page.waitForFunction(() => {
    return !!localStorage.getItem('collab_token') && !document.querySelector('.animate-spin');
  }, { timeout: 15000 });

  // Give a small grace period for SSE connection to open
  await page.waitForTimeout(1000);

  const realUserId = await page.evaluate(() => localStorage.getItem('collab_user_id') || '');
  if (realUserId) {
    user.id = realUserId;
  }

  return { context, page, user };
}

export async function initiateCallViaUI(
  callerPage: Page,
  targetUserId: string,
  targetName: string,
  isVideo: boolean = true
): Promise<void> {
  await callerPage.evaluate(({ targetUserId, targetName, isVideo }) => {
    window.dispatchEvent(
      new CustomEvent('collabpulse:start-call', {
        detail: {
          targetUserId,
          targetName,
          title: `Llamada con ${targetName}`,
          callType: isVideo ? 'video' : 'audio',
          isInitiator: true
        }
      })
    );
  }, { targetUserId, targetName, isVideo });
}

export async function acceptIncomingCall(calleePage: Page): Promise<void> {
  // Wait for incoming call modal or overlay
  const acceptButton = calleePage.locator('button:has-text("Aceptar")').first();
  await acceptButton.waitFor({ state: 'visible', timeout: 15000 });
  await acceptButton.click();
}

export async function checkWebRTCState(page: Page, remoteUserId?: string): Promise<{
  hasPeer: boolean;
  connectionState?: string;
  iceConnectionState?: string;
  remoteTracksCount?: number;
  localTracksCount?: number;
  remoteVideoReady?: boolean;
}> {
  return await page.evaluate((targetId) => {
    const peersMap = (window as any).__collabpulse_peers;
    if (!peersMap || peersMap.size === 0) {
      return { hasPeer: false };
    }

    let peerContext: any = null;
    if (targetId && peersMap.has(targetId)) {
      peerContext = peersMap.get(targetId);
    } else {
      // Pick first available peer
      peerContext = peersMap.values().next().value;
    }

    if (!peerContext || !peerContext.pc) {
      return { hasPeer: false };
    }

    const pc: RTCPeerConnection = peerContext.pc;
    const remoteStream: MediaStream = peerContext.remoteStream;
    const senders = pc.getSenders();

    // Check remote video element in DOM
    const remoteVideo = document.querySelector('video[autoplay]') as HTMLVideoElement | null;
    const hasVideoAttached = !!remoteVideo && (remoteVideo.srcObject !== null || remoteVideo.readyState >= 2);

    return {
      hasPeer: true,
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      remoteTracksCount: remoteStream ? remoteStream.getTracks().length : 0,
      localTracksCount: senders.filter(s => !!s.track).length,
      remoteVideoReady: hasVideoAttached
    };
  }, remoteUserId);
}
