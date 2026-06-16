const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  const errors = [];

  async function check(label, fn) {
    try {
      await fn();
      console.log(`✓ ${label}`);
    } catch (e) {
      console.log(`✗ ${label}: ${e.message}`);
      errors.push({ label, error: e.message });
    }
  }

  // ── 1. Landing page ──
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await check('Landing page loads', async () => {
    await page.waitForSelector('.journey-card, h1', { timeout: 5000 });
  });

  await page.screenshot({ path: '/tmp/bondly-01-landing.png', fullPage: false });
  console.log('Screenshot: /tmp/bondly-01-landing.png');

  // ── 2. Nav to login ──
  await check('Login link visible', async () => {
    await page.click('a[href="/login"], button:has-text("Log in"), a:has-text("Log in")', { timeout: 5000 });
    await page.waitForURL('**/login', { timeout: 5000 });
  });

  await page.screenshot({ path: '/tmp/bondly-02-login.png' });
  console.log('Screenshot: /tmp/bondly-02-login.png');

  // ── 3. Fill login form ──
  await check('Fill email', async () => {
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="mail"]', 'test@test.com');
  });
  await check('Fill password', async () => {
    await page.fill('input[type="password"]', 'test1234');
  });
  await check('Submit login', async () => {
    // Use form submit to avoid ambiguity with tab buttons
    await page.locator('form.auth-form button[type="submit"]').click({ timeout: 3000 });
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  await page.screenshot({ path: '/tmp/bondly-03-dashboard.png', fullPage: false });
  console.log('Screenshot: /tmp/bondly-03-dashboard.png');

  // ── 4. Dashboard overview ──
  await check('Dashboard overview loaded', async () => {
    await page.waitForSelector('.dash-page, .dash-panel-wrap', { timeout: 6000 });
  });
  await page.screenshot({ path: '/tmp/bondly-03b-overview.png', fullPage: false });

  // ── 5. Bonds tab ──
  await check('Bonds tab clickable', async () => {
    await page.click('.dash-tab:has-text("My Bonds")', { timeout: 5000 });
    await page.waitForTimeout(1500);
  });
  await page.screenshot({ path: '/tmp/bondly-04-bonds.png', fullPage: true });
  console.log('Screenshot: /tmp/bondly-04-bonds.png');

  // ── 6. Switch tab ──
  await check('Switch tab clickable', async () => {
    await page.click('.dash-tab:has-text("Switch")', { timeout: 5000 });
    await page.waitForTimeout(1500);
  });
  await page.screenshot({ path: '/tmp/bondly-05-switches.png', fullPage: true });
  console.log('Screenshot: /tmp/bondly-05-switches.png');

  // ── 7. Payments tab ──
  await check('Payments tab clickable', async () => {
    await page.click('.dash-tab:has-text("Payments")', { timeout: 5000 });
    await page.waitForTimeout(1000);
  });
  await page.screenshot({ path: '/tmp/bondly-06-payments.png', fullPage: true });
  console.log('Screenshot: /tmp/bondly-06-payments.png');

  // ── Summary ──
  console.log('\n─────────────────────────────');
  if (errors.length === 0) {
    console.log('All checks passed.');
  } else {
    console.log(`${errors.length} failure(s):`);
    errors.forEach(e => console.log(`  ✗ ${e.label}: ${e.error}`));
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();
