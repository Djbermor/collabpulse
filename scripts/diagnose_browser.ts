import { chromium } from '@playwright/test';

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER UNCAUGHT:', err.message));

  console.log('Navigating to http://localhost:3000...');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('Loaded DOM! Waiting 3s...');
    await page.waitForTimeout(3000);
    const title = await page.title();
    console.log('Title:', title);
    const body = await page.evaluate(() => document.body.innerHTML);
    console.log('Body HTML snippet:', body.substring(0, 800));
  } catch (err: any) {
    console.error('Nav error:', err.message);
  } finally {
    await browser.close();
  }
}

diagnose();
