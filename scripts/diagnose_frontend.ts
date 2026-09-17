import { chromium } from 'playwright';

async function diagnoseFrontend() {
  console.log('=== STARTING REAL FRONTEND DIAGNOSIS ===');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--no-sandbox'
    ]
  });

  const page = await browser.newPage();

  const consoleLogs: string[] = [];
  const errors: string[] = [];
  const networkFailures: string[] = [];

  page.on('console', msg => {
    const text = `[Console ${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      console.error(text);
      errors.push(text);
    }
  });

  page.on('pageerror', err => {
    const text = `[PageError] ${err.message}\n${err.stack}`;
    console.error(text);
    errors.push(text);
  });

  page.on('requestfailed', req => {
    const text = `[RequestFailed] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`;
    console.warn(text);
    networkFailures.push(text);
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      console.warn(`[HTTP ${res.status()}] ${res.request().method()} ${res.url()}`);
    }
  });

  console.log('1. Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  console.log('Page Title:', await page.title());
  console.log('Current URL:', page.url());

  // Check what's rendered
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body snippet:\n', bodyText.substring(0, 500));

  // Check if login form is present
  const emailInput = page.locator('input[autocomplete="username"], input[type="text"]').first();
  const hasEmail = await emailInput.isVisible();
  console.log('Is login identifier input visible?', hasEmail);

  if (hasEmail) {
    console.log('2. Performing login as admin@collabpulse.local...');
    await emailInput.fill('admin@collabpulse.local');
    const pwdInput = page.locator('input[type="password"]').first();
    await pwdInput.fill('CollabPulse2026!Admin');

    const submitBtn = page.locator('form button[type="submit"]').first();
    console.log('Submit button text:', await submitBtn.innerText());
    await submitBtn.click();

    await page.waitForTimeout(3000);
    console.log('After login URL:', page.url());
    const afterLoginText = await page.evaluate(() => document.body.innerText);
    console.log('After login body snippet:\n', afterLoginText.substring(0, 500));

    // Check localStorage
    const authStorage = await page.evaluate(() => ({
      token: localStorage.getItem('collab_token') ? 'PRESENT' : 'MISSING',
      tenantId: localStorage.getItem('collab_tenant_id'),
      userId: localStorage.getItem('collab_user_id'),
      workspaceId: localStorage.getItem('collab_workspace_id')
    }));
    console.log('Auth Storage:', authStorage);

    // Check for sidebar, channels, direct messages
    const sidebar = page.locator('nav, aside, #sidebar, [class*="sidebar"]').first();
    console.log('Sidebar visible?', await sidebar.isVisible());

    // Check calls view / start call button
    const callsBtn = page.locator('button:has-text("Llamadas"), [aria-label*="Llamadas"], [title*="Llamadas"]').first();
    console.log('Calls nav button visible?', await callsBtn.isVisible());
    if (await callsBtn.isVisible()) {
      await callsBtn.click();
      await page.waitForTimeout(1000);
      console.log('In Calls view. Snippet:\n', (await page.evaluate(() => document.body.innerText)).substring(0, 400));
    }
  }

  console.log('=== SUMMARY OF FRONTEND ERRORS ===');
  console.log('Total Console Errors:', errors.length);
  errors.forEach(e => console.log(' -', e));
  console.log('Total Network Failures:', networkFailures.length);
  networkFailures.forEach(f => console.log(' -', f));

  await browser.close();
}

diagnoseFrontend().catch(err => {
  console.error('Fatal diagnosis error:', err);
  process.exit(1);
});
