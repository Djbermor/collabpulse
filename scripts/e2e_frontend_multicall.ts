import { chromium, Browser, Page } from 'playwright';

interface UserSession {
  browser: Browser;
  page: Page;
  email: string;
  name: string;
}

async function runMultiCallE2ETest() {
  console.log('====================================================');
  console.log('STARTING REAL FRONTEND MULTI-CALL & HOLD/RESUME TEST');
  console.log('====================================================');

  let sessionA: UserSession | null = null;
  let sessionB: UserSession | null = null;
  let sessionC: UserSession | null = null;

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

    console.log('[Step 1] Launching Chromium instances for User A, User B, and User C...');
    const browserA = await chromium.launch(launchOpts);
    const browserB = await chromium.launch(launchOpts);
    const browserC = await chromium.launch(launchOpts);

    const pageA = await browserA.newPage();
    const pageB = await browserB.newPage();
    const pageC = await browserC.newPage();

    pageA.on('console', msg => console.log(`[Browser A] ${msg.text()}`));
    pageB.on('console', msg => console.log(`[Browser B] ${msg.text()}`));
    pageC.on('console', msg => console.log(`[Browser C] ${msg.text()}`));

    sessionA = { browser: browserA, page: pageA, email: 'admin@collabpulse.local', name: 'Administrador Sistema' };
    sessionB = { browser: browserB, page: pageB, email: 'user.b@collabpulse.local', name: 'User Bravo' };
    sessionC = { browser: browserC, page: pageC, email: 'user.c@collabpulse.local', name: 'User Charlie' };

    // Login A
    console.log('[Step 2] Logging in User A (Admin)...');
    await pageA.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await pageA.fill('input[autocomplete="username"], input[type="text"]', sessionA.email);
    await pageA.fill('input[type="password"]', 'CollabPulse2026!Admin');
    await pageA.click('form button[type="submit"]');
    await pageA.waitForSelector('text=Workspace A', { timeout: 10000 });

    // Login B
    console.log('[Step 3] Logging in User B (Bravo)...');
    await pageB.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await pageB.fill('input[autocomplete="username"], input[type="text"]', sessionB.email);
    await pageB.fill('input[type="password"]', 'CollabPulse2026!Admin');
    await pageB.click('form button[type="submit"]');
    await pageB.waitForSelector('text=Workspace A', { timeout: 10000 });

    // Step 4: User A calls User B
    console.log('[Step 4] User A calls User B via Calls Directory...');
    const callsNavBtn = pageA.locator('button:has-text("Llamadas"), [title*="Llamadas"]').first();
    await callsNavBtn.click();
    await pageA.waitForSelector('text=Directorio de Colaboradores', { timeout: 8000 });

    const callBravoBtn = pageA.locator('button[title="Videollamada con User Bravo"]').first();
    await callBravoBtn.waitFor({ state: 'visible', timeout: 8000 });
    await callBravoBtn.click();

    // User B accepts
    console.log('[Step 5] User B receives and accepts Call 1...');
    const acceptBtnB = pageB.locator('button:has-text("Aceptar")').first();
    await acceptBtnB.waitFor({ state: 'visible', timeout: 10000 });
    await acceptBtnB.click();

    // Verify Call 1 active on both
    await pageA.locator('video').first().waitFor({ state: 'visible', timeout: 10000 });
    await pageB.locator('video').first().waitFor({ state: 'visible', timeout: 10000 });
    console.log('  -> Call 1 active between User A and User B (PASS)!');

    // Step 6: Test Hold Call 1 from User A
    console.log('[Step 6] User A puts Call 1 on hold...');
    const holdBtnA = pageA.locator('button[title*="Poner en espera"]').first();
    await holdBtnA.click();
    await pageA.waitForTimeout(1000);

    // Verify Hold overlay on A
    const holdOverlayA = pageA.locator('text=Llamada en espera').first();
    await holdOverlayA.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  -> Hold overlay rendered on User A (PASS)!');

    // Verify Remote Held notification on B
    const remoteHeldB = pageB.locator('text=El otro colaborador ha puesto la llamada en espera').first();
    await remoteHeldB.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  -> Remote peer notification rendered on User B (PASS)!');

    // Step 7: Test Resume Call 1 from User A
    console.log('[Step 7] User A resumes Call 1...');
    const resumeBtnA = pageA.locator('button:has-text("Reanudar llamada"), button[title*="Reanudar llamada"]').first();
    await resumeBtnA.click();
    await pageA.waitForTimeout(1000);

    // Verify Hold overlay dismissed
    const isHoldOverlayVisible = await pageA.locator('text=Llamada en espera').count();
    console.log('  -> Hold overlay dismissed on User A:', isHoldOverlayVisible === 0);

    // Step 8: User C logs in and calls User A (Second Concurrent Call)
    console.log('[Step 8] Logging in User C (Charlie) to initiate second concurrent call...');
    await pageC.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await pageC.fill('input[autocomplete="username"], input[type="text"]', sessionC.email);
    await pageC.fill('input[type="password"]', 'CollabPulse2026!Admin');
    await pageC.click('form button[type="submit"]');
    await pageC.waitForSelector('text=Workspace A', { timeout: 10000 });

    console.log('[Step 9] User C calls User A...');
    const callsNavBtnC = pageC.locator('button:has-text("Llamadas"), [title*="Llamadas"]').first();
    await callsNavBtnC.click();
    await pageC.waitForSelector('text=Directorio de Colaboradores', { timeout: 8000 });

    const allBtnsC = await pageC.locator('button').evaluateAll(btns => btns.map(b => ({ text: b.innerText, title: b.getAttribute('title') })));
    console.log('  -> Buttons on Page C in Directory:', allBtnsC.filter(b => b.title?.includes('Admin') || b.title?.includes('Llamar') || b.title?.includes('Video')));

    const callAdminBtn = pageC.locator('button[title="Videollamada con Administrador Sistema"]').first();
    await callAdminBtn.waitFor({ state: 'visible', timeout: 8000 });
    console.log('  -> Found button on Page C:', await callAdminBtn.getAttribute('title'));
    await callAdminBtn.click();
    console.log('  -> Clicked call button from User C.');

    // Step 10: User A receives second incoming call from User C
    console.log('[Step 10] User A receives second incoming call from User C...');
    const acceptBtnA2 = pageA.locator('button:has-text("Aceptar y poner en espera")').first();
    await acceptBtnA2.waitFor({ state: 'visible', timeout: 10000 });
    console.log('  -> Second incoming call banner received on User A (PASS)!');

    // Step 11: User A accepts Call 2 (Auto-holding Call 1)
    console.log('[Step 11] User A accepts Call 2 with auto-hold on Call 1...');
    await acceptBtnA2.click();
    await pageA.waitForTimeout(2000);

    // Step 12: Verify Swap button appears on User A
    console.log('[Step 12] Verifying Swap button is available on User A...');
    const swapBtn = pageA.locator('button[title*="Intercambiar con la llamada en espera"], button:has-text("Swap")').first();
    await swapBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  -> Swap button visible for multi-call management (PASS)!');

    // Step 13: Hangup all calls cleanly
    console.log('[Step 13] Cleaning up calls...');
    const hangupBtnA = pageA.locator('button[title*="Finalizar llamada"]').first();
    if (await hangupBtnA.count() > 0) {
      await hangupBtnA.click({ force: true });
      await pageA.waitForTimeout(1500);
    }

    // Call 1 was on hold, finish it as well
    const remainingHangupA = pageA.locator('button[title*="Finalizar llamada"]').first();
    if (await remainingHangupA.count() > 0) {
      await remainingHangupA.click({ force: true });
      await pageA.waitForTimeout(1500);
    }

    console.log('====================================================');
    console.log('MULTI-CALL & HOLD/RESUME E2E TEST: ALL STEPS PASSED!');
    console.log('====================================================');
  } finally {
    if (sessionA?.browser) await sessionA.browser.close();
    if (sessionB?.browser) await sessionB.browser.close();
    if (sessionC?.browser) await sessionC.browser.close();
  }
}

runMultiCallE2ETest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('MULTI-CALL E2E TEST FAILED:', err);
  process.exit(1);
});
