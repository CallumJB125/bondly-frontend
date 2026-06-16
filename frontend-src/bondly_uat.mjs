import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const ss     = (page, name) => page.screenshot({ path: `/tmp/uat_${name}.png` });
const ssFull = (page, name) => page.screenshot({ path: `/tmp/uat_${name}_full.png`, fullPage: true });

async function dismissConsent(page) {
  await page.evaluate(() => localStorage.setItem('bondly_consent', '1'));
  const ok = page.locator('button:has-text("OK")');
  if (await ok.isVisible({ timeout: 800 }).catch(() => false)) await ok.click().catch(() => {});
}

const browser = await chromium.launch({ headless: false, slowMo: 280 });

// ── PERSONA A: Sarah Dlamini (First-time buyer, R38k/mo) ──────────────────
console.log('\n── PERSONA A: Sarah Dlamini ──');
{
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await dismissConsent(page);
  await page.waitForTimeout(500);
  await ss(page, 'A1_landing_default');

  // Switch to Buy tab
  const tabs = page.locator('.hero__tabs button, .hero__tab');
  if (await tabs.count() >= 2) { await tabs.nth(1).click(); await page.waitForTimeout(500); }
  await ss(page, 'A2_buy_tab');

  // Enter income
  const incomeField = page.locator('input[placeholder*="45"], input[placeholder*="income"]').first();
  if (await incomeField.count()) { await incomeField.fill('38000'); await page.waitForTimeout(500); }
  await ss(page, 'A3_income_entered');

  // Hero CTA via JS to avoid overlay
  await page.evaluate(() => { const b = document.querySelector('button.hero__calc-cta'); if(b) b.click(); });
  await page.waitForTimeout(800);
  await ss(page, 'A4_after_hero_cta');

  // Pre-approval page
  await page.goto(`${BASE}/preapproval`, { waitUntil: 'networkidle' });
  await dismissConsent(page);
  await page.waitForTimeout(600);
  await ss(page, 'A5_preapproval_top');
  await ssFull(page, 'A5_preapproval_full');

  await page.evaluate(() => window.scrollTo({ top: 600 }));
  await page.waitForTimeout(400);
  await ss(page, 'A6_preapproval_mid');

  await page.evaluate(() => window.scrollTo({ top: 1400 }));
  await page.waitForTimeout(400);
  await ss(page, 'A7_preapproval_bottom');

  // Fill income field
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await page.waitForTimeout(300);
  const inp = page.locator('input[type="number"], input[type="text"]').first();
  if (await inp.count()) { await inp.click(); await inp.fill('38000'); await page.waitForTimeout(300); }
  
  // Click calculate via JS
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(b => /calculate|next|check|qualify/i.test(b.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(1500);
  await ss(page, 'A8_preapproval_result');
  await ssFull(page, 'A8_preapproval_result_full');

  // Register page
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
  await dismissConsent(page);
  await page.waitForTimeout(400);
  await ss(page, 'A9_register');
  
  await page.locator('input[placeholder*="name"], input[name="name"]').first().fill('Sarah Dlamini').catch(() => {});
  await page.locator('input[type="email"]').first().fill('sarah.test@bondlytest.co.za').catch(() => {});
  await page.locator('input[type="password"]').first().fill('TestPass2026!').catch(() => {});
  await ss(page, 'A10_register_filled');

  await ctx.close();

  // Mobile preapproval
  const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mPage = await mCtx.newPage();
  await mPage.goto(`${BASE}/preapproval`, { waitUntil: 'networkidle' });
  await mPage.evaluate(() => localStorage.setItem('bondly_consent', '1'));
  await mPage.waitForTimeout(500);
  await mPage.screenshot({ path: '/tmp/uat_A11_preapproval_mobile.png' });
  await mPage.evaluate(() => window.scrollTo({ top: 500 }));
  await mPage.waitForTimeout(300);
  await mPage.screenshot({ path: '/tmp/uat_A12_preapproval_mobile_scroll.png' });
  await mCtx.close();
}

// ── PERSONA B: Michael van Zyl (Bond switch, R950k, 13%) ─────────────────
console.log('\n── PERSONA B: Michael van Zyl ──');
{
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/switch`, { waitUntil: 'networkidle' });
  await dismissConsent(page);
  await page.waitForTimeout(500);
  await ss(page, 'B1_switch_blank');
  await ssFull(page, 'B1_switch_blank_full');

  // Fill form
  const inputs = page.locator('.switch-form__input');
  await inputs.nth(0).click(); await inputs.nth(0).fill('950000');
  await inputs.nth(1).click(); await inputs.nth(1).fill('13');
  await inputs.nth(2).click(); await inputs.nth(2).fill('62000');
  await page.waitForTimeout(300);
  await ss(page, 'B2_switch_filled');

  // Submit
  await page.locator('button:has-text("Check my savings")').click();
  await page.waitForTimeout(400);
  await ss(page, 'B3_reading_start');
  await page.waitForTimeout(1600);
  await ss(page, 'B4_reading_mid');
  await page.waitForTimeout(2200);
  await ss(page, 'B5_reading_done');
  await page.waitForTimeout(700);

  await ss(page, 'B6_verdict_top');
  await ssFull(page, 'B6_verdict_full');

  // Expand all "How we got this"
  const hows = page.locator('.switch-verdict__how');
  for (let i = 0; i < await hows.count(); i++) {
    await hows.nth(i).dispatchEvent('click');
    await page.waitForTimeout(200);
  }
  await ss(page, 'B7_how_all_expanded');

  await page.evaluate(() => window.scrollTo({ top: 900 }));
  await page.waitForTimeout(400);
  await ss(page, 'B8_bank_table');

  // Click proceed via JS (bypass sticky bar / consent overlay)
  await page.evaluate(() => {
    const btn = document.querySelector('.switch-verdict__cta');
    if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(800);
  await ss(page, 'B9_after_proceed');

  await ctx.close();

  // Demo mode
  const dCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dPage = await dCtx.newPage();
  await dPage.goto(`${BASE}/switch/demo`, { waitUntil: 'networkidle' });
  await dPage.evaluate(() => localStorage.setItem('bondly_consent', '1'));
  await dPage.waitForTimeout(500);
  await dPage.screenshot({ path: '/tmp/uat_B10_demo_top.png' });
  await ssFull(dPage, 'B10_demo_full');
  await dCtx.close();

  // Mobile switch
  const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mPage = await mCtx.newPage();
  await mPage.goto(`${BASE}/switch`, { waitUntil: 'networkidle' });
  await mPage.evaluate(() => localStorage.setItem('bondly_consent', '1'));
  await mPage.waitForTimeout(400);
  await mPage.screenshot({ path: '/tmp/uat_B11_switch_mobile.png' });
  const mInputs = mPage.locator('.switch-form__input');
  await mInputs.nth(0).fill('950000');
  await mInputs.nth(1).fill('13');
  await mInputs.nth(2).fill('62000');
  await mPage.screenshot({ path: '/tmp/uat_B12_switch_mobile_filled.png' });
  await mPage.locator('button:has-text("Check my savings")').click();
  await mPage.waitForTimeout(4200);
  await mPage.screenshot({ path: '/tmp/uat_B13_verdict_mobile.png' });
  await mPage.evaluate(() => window.scrollTo({ top: 700 }));
  await mPage.waitForTimeout(300);
  await mPage.screenshot({ path: '/tmp/uat_B14_banks_mobile.png' });
  await mCtx.close();
}

await browser.close();
console.log('\n✓ All UAT screenshots saved.');
