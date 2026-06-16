const { chromium } = require('playwright');
const fs = require('fs');

const BASE  = 'http://localhost:5173';
const EMAIL = `test-caleb-${Date.now()}@bondly.co.za`;
const PASS  = 'Test1234!';
const PDF   = '/tmp/Caleb_March2026.pdf';
const SHOTS = '/tmp/bondly-shots';

if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const shot = async (page, name) => {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
  console.log(`📸  ${name}.png`);
};

const dismissCookies = async (page) => {
  const btn = page.locator('button').filter({ hasText: /^OK$/i }).first();
  if (await btn.count() > 0) await btn.click().catch(() => {});
  await page.waitForTimeout(300);
};

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // ── 1. Register ──────────────────────────────────────────────────────────
  console.log('1. Registering test account…');
  await page.goto(`${BASE}/register`);
  await dismissCookies(page);

  await page.fill('input[type="text"]', 'Caleb Test').catch(() => {});
  // Try name field if the above didn't work
  const nameField = page.locator('input[name="name"], input[placeholder*="name" i]').first();
  if (await nameField.count() > 0) await nameField.fill('Caleb Test').catch(() => {});

  await page.fill('input[type="email"]', EMAIL);
  const pwFields = page.locator('input[type="password"]');
  const pwCount = await pwFields.count();
  if (pwCount >= 1) await pwFields.nth(0).fill(PASS);
  if (pwCount >= 2) await pwFields.nth(1).fill(PASS);

  // ToS checkbox
  const tos = page.locator('input[type="checkbox"]').first();
  if (await tos.count() > 0 && !(await tos.isChecked())) await tos.check();

  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.includes('/register'), { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-after-register');

  // If still on register/login, fall back to sign in with the registered account
  if (page.url().includes('/register') || page.url().includes('/login')) {
    console.log('   Registration may have failed — trying sign-in…');
    await page.goto(`${BASE}/login`);
    await dismissCookies(page);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    const loginTos = page.locator('input[type="checkbox"]').first();
    if (await loginTos.count() > 0 && !(await loginTos.isChecked())) await loginTos.check();
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.includes('/login'), { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  // ── 2. Dashboard ─────────────────────────────────────────────────────────
  console.log('2. Going to dashboard…');
  if (!page.url().includes('/dashboard')) {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(1500);
  }
  await dismissCookies(page);
  await shot(page, '02-dashboard-home');

  // ── 3. Upload Caleb's statement via Bond → Scan Statement ────────────────
  console.log('3. Uploading statement via Bond → Scan Statement…');
  const bondTab = page.locator('button, [role="tab"]').filter({ hasText: /^Bond$/i }).first();
  if (await bondTab.count() > 0) {
    await bondTab.click();
    await page.waitForTimeout(800);
  }

  const scanTab = page.locator('button, [role="tab"], li').filter({ hasText: /scan/i }).first();
  if (await scanTab.count() > 0) {
    await scanTab.click();
    await page.waitForTimeout(800);
  }
  await shot(page, '03-scan-tab');

  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(PDF);
    await page.waitForTimeout(800);
    await shot(page, '04-file-selected');

    const analyseBtn = page.locator('button').filter({ hasText: /analys/i }).first();
    if (await analyseBtn.count() > 0) {
      await analyseBtn.click();
      console.log('   Waiting for analysis (up to 90s)…');
      await page.waitForFunction(() => {
        const hasLoaders = document.querySelectorAll('[class*="loading"],[class*="spinner"],[class*="loader"]').length > 0;
        const hasResult  = !!document.querySelector('[class*="result"],[class*="fitness"],[class*="hero"],[class*="score"]');
        return !hasLoaders || hasResult;
      }, { timeout: 90000 }).catch(() => console.log('   (timed out — taking screenshot anyway)'));
      await page.waitForTimeout(2000);
      await shot(page, '05-analysis-result');
    }
  } else {
    console.log('   No file input found — skipping upload');
  }

  // ── 4. Money → Score tab ─────────────────────────────────────────────────
  console.log('4. Money → Score tab…');
  const moneyTab = page.locator('button, [role="tab"]').filter({ hasText: /^Money$/i }).first();
  if (await moneyTab.count() > 0) {
    await moneyTab.click();
    await page.waitForTimeout(800);
  }

  const scoreTab = page.locator('button, [role="tab"]').filter({ hasText: /^Score$/i }).first();
  if (await scoreTab.count() > 0) {
    await scoreTab.click();
    await page.waitForTimeout(2500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '06-score-hero');

  // Scroll to simulator
  await page.evaluate(() => window.scrollTo(0, 350));
  await page.waitForTimeout(400);
  await shot(page, '07-score-simulator');

  // Move slider
  const slider = page.locator('.rsc-sim__slider').first();
  if (await slider.count() > 0) {
    const box = await slider.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.65, box.y + box.height / 2);
      await page.waitForTimeout(600);
      await shot(page, '08-simulator-active');
    }
  }

  // Scroll to timeline + bank confidence
  await page.evaluate(() => window.scrollTo(0, 750));
  await page.waitForTimeout(500);
  await shot(page, '09-timeline-banks');

  // ── 5. Weak component card ───────────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 200));
  const weakCard = page.locator('.rsc-comp--weak').first();
  if (await weakCard.count() > 0) {
    await weakCard.click();
    await page.waitForTimeout(400);
    await shot(page, '10-weak-component');
  }

  // ── 6. Bank View tab ─────────────────────────────────────────────────────
  console.log('5. Bank View tab…');
  await page.evaluate(() => window.scrollTo(0, 0));
  const bankViewTab = page.locator('button, [role="tab"]').filter({ hasText: /bank/i }).first();
  if (await bankViewTab.count() > 0) {
    await bankViewTab.click();
    await page.waitForTimeout(2000);
    await shot(page, '11-bank-view-signals');

    // Click a red (high) signal
    const redCard = page.locator('.bv-signal--high').first();
    if (await redCard.count() > 0) {
      await redCard.click();
      await page.waitForTimeout(500);
      await shot(page, '12-coaching-high');
    }

    // Click a green (low) signal
    const greenCard = page.locator('.bv-signal--low').first();
    if (await greenCard.count() > 0) {
      await greenCard.click();
      await page.waitForTimeout(400);
      await shot(page, '13-coaching-low');
    }
  }

  // ── 7. Generate dossier ──────────────────────────────────────────────────
  console.log('6. Generating bank dossier…');
  const dossierBtn = page.locator('.bv-dossier-btn').first();
  if (await dossierBtn.count() > 0) {
    await dossierBtn.click();
    console.log('   Waiting for dossier (up to 15s)…');
    await page.waitForSelector('.bv-modal', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, '14-bank-dossier');
    const closeBtn = page.locator('.bv-modal__close').first();
    if (await closeBtn.count() > 0) await closeBtn.click();
  }

  const count = fs.readdirSync(SHOTS).length;
  console.log(`\n✅  Done — ${count} screenshots in ${SHOTS}`);
  await browser.close();
})().catch(e => { console.error('\n❌  Test failed:', e.message); process.exit(1); });
