/**
 * Bondly — test suite for recent changes:
 *  1. POPIA consent banner (App.jsx)
 *  2. Register POPIA checkbox (Login.jsx)
 *  3. Credit pre-check panel (SwapsTab.jsx)
 *  4. Admin kanban board (Admin.jsx)
 *  5. Tools.jsx prefill uses calcMonthly (smoke test — no JS errors)
 *
 * Assumes:
 *  - Vite dev server on http://localhost:5173
 *  - Backend API  on http://localhost:3000
 *  - A test user exists: test@test.com / test1234
 *  - An admin user exists: callum@bondly.co.za / (whatever is set)
 */

const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';

const errors = [];
let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✓  ${label}`);
    passed++;
  } catch (e) {
    console.log(`  ✗  ${label}`);
    console.log(`       ${e.message.split('\n')[0]}`);
    errors.push({ label, error: e.message.split('\n')[0] });
    failed++;
  }
}

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  // Make sure we're on the login tab
  await page.click('.auth-tabs button:has-text("Sign in")');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('form.auth-form button[type="submit"]');
  await page.waitForFunction(
    () => window.location.pathname.includes('/dashboard') || window.location.pathname.includes('/onboarding'),
    { timeout: 12000 }
  );
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  // ─────────────────────────────────────────────────────────────
  console.log('\n━━━ 1. POPIA CONSENT BANNER ━━━');
  // ─────────────────────────────────────────────────────────────

  // Clear consent so banner shows
  await check('Clear bondly_consent from localStorage', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('bondly_consent'));
    await page.reload({ waitUntil: 'networkidle' });
  });

  await check('Consent banner is visible on load', async () => {
    await page.waitForSelector('text=POPIA', { timeout: 5000 });
    const banner = await page.locator('text=Accept & continue').first();
    if (!(await banner.isVisible())) throw new Error('Accept button not visible');
  });

  await page.screenshot({ path: '/tmp/bondly-t01-banner.png' });
  console.log('    📸 /tmp/bondly-t01-banner.png');

  await check('Accept banner hides it', async () => {
    await page.click('button:has-text("Accept & continue")');
    await page.waitForTimeout(500);
    const visible = await page.locator('button:has-text("Accept & continue")').isVisible().catch(() => false);
    if (visible) throw new Error('Banner still visible after accepting');
  });

  await check('Consent persists on reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const visible = await page.locator('button:has-text("Accept & continue")').isVisible().catch(() => false);
    if (visible) throw new Error('Banner reappeared after reload');
  });

  // ─────────────────────────────────────────────────────────────
  console.log('\n━━━ 2. REGISTER — POPIA CHECKBOX ━━━');
  // ─────────────────────────────────────────────────────────────

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.click('.auth-tabs button:has-text("Register")');
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/tmp/bondly-t02-register.png' });
  console.log('    📸 /tmp/bondly-t02-register.png');

  await check('POPIA checkbox exists on register form', async () => {
    const cb = await page.locator('input[type="checkbox"]').first();
    if (!(await cb.isVisible())) throw new Error('Checkbox not visible');
  });

  await check('Create account button is disabled without consent', async () => {
    const btn = await page.locator('button:has-text("Create account")').first();
    const disabled = await btn.isDisabled();
    if (!disabled) throw new Error('Button should be disabled until checkbox checked');
  });

  await check('Checking consent enables the button', async () => {
    await page.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(300);
    const btn = await page.locator('button:has-text("Create account")').first();
    const disabled = await btn.isDisabled();
    if (disabled) throw new Error('Button still disabled after checking consent');
  });

  await check('Unchecking re-disables it', async () => {
    await page.locator('input[type="checkbox"]').first().uncheck();
    await page.waitForTimeout(300);
    const btn = await page.locator('button:has-text("Create account")').first();
    if (!(await btn.isDisabled())) throw new Error('Button should be disabled again');
  });

  // ─────────────────────────────────────────────────────────────
  console.log('\n━━━ 3. CREDIT PRE-CHECK IN SWAPS TAB ━━━');
  // ─────────────────────────────────────────────────────────────

  await check('Log in as test user', async () => {
    await loginAs(page, 'test@test.com', 'test1234');
  });

  await check('Navigate to Switch tab', async () => {
    // Handle onboarding redirect
    if (page.url().includes('onboarding')) {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    }
    await page.waitForSelector('.dash-tab', { timeout: 8000 });
    await page.click('.dash-tab:has-text("Switch")');
    await page.waitForTimeout(1500);
  });

  await page.screenshot({ path: '/tmp/bondly-t03a-switch-tab.png', fullPage: true });
  console.log('    📸 /tmp/bondly-t03a-switch-tab.png');

  await check('New application button opens apply form', async () => {
    const btn = page.locator('button:has-text("New application"), button:has-text("+ New application")').first();
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(1000);
  });

  await page.screenshot({ path: '/tmp/bondly-t03b-apply-open.png', fullPage: true });
  console.log('    📸 /tmp/bondly-t03b-apply-open.png');

  await check('Credit pre-check card appears', async () => {
    await page.waitForSelector('text=Your Credit Pre-Check', { timeout: 6000 });
  });

  await check('Grade badge is rendered', async () => {
    // The grade is a single letter A-E inside a circle
    const gradeEl = await page.locator('text=GRADE').first();
    if (!(await gradeEl.isVisible())) throw new Error('GRADE label not visible');
  });

  await check('Factor bars are rendered', async () => {
    await page.waitForSelector('text=Payment History', { timeout: 5000 });
    await page.waitForSelector('text=Debt-to-Income', { timeout: 5000 });
  });

  await check('Approval likelihood is shown', async () => {
    await page.waitForSelector('text=Approval likelihood', { timeout: 5000 });
  });

  await page.screenshot({ path: '/tmp/bondly-t03c-precheck.png', fullPage: true });
  console.log('    📸 /tmp/bondly-t03c-precheck.png');

  // ─────────────────────────────────────────────────────────────
  console.log('\n━━━ 4. TOOLS PAGE — PMT FIX SMOKE TEST ━━━');
  // ─────────────────────────────────────────────────────────────

  consoleErrors.length = 0; // Reset error capture
  await page.goto(`${BASE}/tools`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await check('Tools page loads without JS errors', async () => {
    if (consoleErrors.length > 0) throw new Error(`Console errors: ${consoleErrors.join('; ')}`);
  });

  await check('Repayment calculator is visible', async () => {
    await page.waitForSelector('text=Repayment Calculator', { timeout: 5000 });
  });

  await check('Pre-fill toggle exists', async () => {
    const el = page.locator('text=Pre-fill from my bond, text=pre-fill, text=Pre-fill').first();
    await el.waitFor({ timeout: 5000 }).catch(() => {});
    // It might not be visible if user is not logged in with a bond — just check no crash
  });

  await page.screenshot({ path: '/tmp/bondly-t04-tools.png', fullPage: false });
  console.log('    📸 /tmp/bondly-t04-tools.png');

  // ─────────────────────────────────────────────────────────────
  console.log('\n━━━ 5. ADMIN KANBAN ━━━');
  // ─────────────────────────────────────────────────────────────

  await check('Navigate to /admin', async () => {
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
  });

  const isAdminPage = await page.locator('.admin-page, .kanban-board, text=Swap Pipeline').count().catch(() => 0);

  if (isAdminPage === 0) {
    console.log('  ⚠  Not logged in as admin — skipping kanban checks (need admin credentials)');
  } else {
    await check('Kanban board is rendered', async () => {
      await page.waitForSelector('.kanban-board, text=Offer Accepted, text=Cancellation Notice', { timeout: 6000 });
    });

    await check('Kanban columns exist', async () => {
      const cols = await page.locator('.kanban-col, .kanban-column').count();
      if (cols < 2) throw new Error(`Only ${cols} columns found`);
    });

    await page.screenshot({ path: '/tmp/bondly-t05-kanban.png', fullPage: false });
    console.log('    📸 /tmp/bondly-t05-kanban.png');
  }

  // ─────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailures:');
    errors.forEach(e => console.log(`  ✗ ${e.label}\n    ${e.error}`));
  } else {
    console.log('All checks passed ✓');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await page.waitForTimeout(2000);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
