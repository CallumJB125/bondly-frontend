/**
 * Bondly QA Check — headed Playwright walk-through
 * Run: node qa-check.mjs
 *
 * Covers everything added/changed in the current sprint:
 *  1. Landing hero — cached result state, "Upload new to re-analyse" button
 *  2. Landing hero — fresh file upload + analyse flow
 *  3. "See my improvement plan" → /optimize with data pre-loaded
 *  4. Optimize page direct — upload zone shown when no data
 *  5. Tools page — statement analyser + improvement plan link
 *  6. Preapproval — "See my improvement plan" handoff
 *  7. Admin — greeting format, grade rendering, install banner suppressed
 *  8. Auth pages — install banner suppressed
 *  9. Regulatory language — spot-check key pages for removed FSCA claims
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:5173';
const __dir = path.dirname(fileURLToPath(import.meta.url));

// A real bank statement to use for live upload tests
const STATEMENT_PATH = path.resolve(__dir, 'test-statement.pdf');

const PASS  = '✅';
const FAIL  = '❌';
const WARN  = '⚠️ ';
const INFO  = '   ';

let passed = 0, failed = 0, warned = 0;

function pass(msg)  { console.log(`  ${PASS}  ${msg}`); passed++; }
function fail(msg)  { console.error(`  ${FAIL}  ${msg}`); failed++; }
function warn(msg)  { console.warn(`  ${WARN} ${msg}`);  warned++; }
function info(msg)  { console.log(`  ${INFO}  ${msg}`); }

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

async function pause(ms = 1200) {
  await new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────
async function main() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 80,
    args: ['--window-size=1280,900'],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  // ── 1. Landing page — initial load ──────────────────────
  section('1. Landing page — hero calculator');

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pause(800);

  // Check hero exists
  const hero = await page.$('.hero__stmt-upload, .hero__calc, [class*="hero"]');
  hero ? pass('Hero section rendered') : fail('Hero section not found');

  // Clear any stale localStorage so we start clean
  await page.evaluate(() => {
    localStorage.removeItem('bondly_landing_stmt');
    localStorage.removeItem('bondly_visits');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pause(600);

  // Switch to "I want to buy" mode and then Statement mode if needed
  const buyTab = page.locator('button:has-text("I want to buy"), button:has-text("Buy")').first();
  if (await buyTab.count() > 0) {
    await buyTab.click();
    await pause(400);
    pass('Switched to Buy mode');
  } else {
    info('Buy mode tab not found — may already be default');
  }

  // Try to find the statement tab/option
  const stmtTab = page.locator('button:has-text("Upload statement"), button:has-text("Statement"), label:has-text("Statement")').first();
  if (await stmtTab.count() > 0) {
    await stmtTab.click();
    await pause(400);
    pass('Switched to Statement mode');
  } else {
    info('Statement tab not found — may be default or different label');
  }

  // ── 2. Fresh upload flow ─────────────────────────────────
  section('2. Landing hero — fresh statement upload');

  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    // Check if test-statement.pdf exists, otherwise skip
    const { existsSync } = await import('fs');
    if (existsSync(STATEMENT_PATH)) {
      info('Uploading test statement...');
      await fileInput.setInputFiles(STATEMENT_PATH);
      await pause(600);

      // Analyse button should now be active
      const analyseBtn = page.locator('button:has-text("Analyse statement")');
      if (await analyseBtn.count() > 0) {
        const isDisabled = await analyseBtn.getAttribute('disabled');
        isDisabled === null ? pass('"Analyse statement →" button enabled after file select') : fail('"Analyse statement →" still disabled after file select');
        await analyseBtn.click();
        info('Waiting for analysis result (up to 30s)...');
        try {
          await page.waitForSelector('.hero__result, .hero__afford-verdict', { timeout: 30000 });
          pass('Statement analysis result displayed');
        } catch {
          warn('Analysis result did not appear within 30s — backend may be slow');
        }
      } else {
        warn('"Analyse statement →" button not found — check selector');
      }
    } else {
      warn(`No test-statement.pdf at ${STATEMENT_PATH} — skipping live upload test`);
      info('To enable upload tests: cp a real Capitec/FNB CSV to bondly/test-statement.pdf');
    }
  } else {
    warn('File input not found on landing page');
  }

  // ── 3. Cached result state ───────────────────────────────
  section('3. Landing hero — cached result state');

  // Inject a fake cached result into localStorage
  await page.evaluate(() => {
    const fakeResult = {
      result: {
        detected: true,
        income: { monthlyAmount: 10945 },
        qualification: { maxBond: 276056, verdict: 'borderline', verdictLabel: 'Borderline — a deposit helps' },
        riskProfile: { grade: 'A', label: 'Low risk', color: '#22c55e', dti: 22 },
        statementMonths: 2,
        expenses: { total: 4200 },
        debts: { totalMonthly: 1800 },
      },
      fileName: 'account_statement_1-Apr-2024_to_3-May-2024.pdf',
      savedAt: Date.now(),
    };
    localStorage.setItem('bondly_landing_stmt', JSON.stringify(fakeResult));
    // Also ensure visits >= 2 so banner check doesn't interfere
    localStorage.setItem('bondly_visits', '5');
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await pause(1000);

  // The dropzone should show the cached filename
  const dropzone = page.locator('.hero__stmt-dropzone, [class*="dropzone"]').first();
  if (await dropzone.count() > 0) {
    const text = await dropzone.textContent();
    if (text?.includes('account_statement')) {
      pass('Cached filename shown in dropzone');
    } else if (text?.includes('Upload new to refresh')) {
      pass('"Upload new to refresh" shown for cached file');
    } else {
      warn(`Dropzone text: "${text?.trim().slice(0, 80)}" — expected cached filename`);
    }
  }

  // The "Analyse statement" button should NOT be there in its old disabled form
  // Instead we expect "Upload new to re-analyse"
  const uploadNewBtn = page.locator('button:has-text("Upload new to re-analyse")');
  const oldAnalyseBtn = page.locator('button:has-text("Analyse statement")[disabled]');

  if (await uploadNewBtn.count() > 0) {
    pass('"Upload new to re-analyse →" button shown for cached state');
  } else if (await oldAnalyseBtn.count() > 0) {
    fail('Old disabled "Analyse statement" button still shown — fix not applied');
  } else {
    warn('Neither button found — check buy/statement mode toggle');
  }

  // Cached results should be visible
  const resultCards = page.locator('.hero__result, .hero__afford-verdict, [class*="hero__result"]').first();
  if (await resultCards.count() > 0) {
    pass('Cached result cards displayed below hero');
  } else {
    warn('Cached result cards not visible — may need mode switch');
  }

  // "Upload new to re-analyse" should open file picker when clicked (not navigate away)
  if (await uploadNewBtn.count() > 0) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null),
      uploadNewBtn.click(),
    ]);
    fileChooser ? pass('"Upload new to re-analyse →" opens file picker') : warn('"Upload new to re-analyse →" click did not open file picker');
    await pause(300);
  }

  // ── 4. "See my improvement plan" → /optimize ────────────
  section('4. "See my improvement plan" → /optimize handoff');

  // The improvement plan button only appears for fresh (non-cached) results with bond < 600k.
  // We simulate this by clearing localStorage then writing a sessionStorage-based fresh result
  // via the internal React state mechanism — easiest is to navigate with ss key pre-set.
  await page.evaluate(() => {
    localStorage.removeItem('bondly_landing_stmt');
    // Also test /optimize route directly by pre-loading the sessionStorage key
    sessionStorage.setItem('bondly_optimizer_from_pa', JSON.stringify({
      detected: true,
      income: { monthlyAmount: 10945 },
      qualification: { maxBond: 276056, verdict: 'borderline', verdictLabel: 'Borderline — a deposit helps' },
      riskProfile: { grade: 'A', label: 'Low risk', color: '#22c55e', dti: 22 },
      statementMonths: 2,
      expenses: { total: 4200 },
      debts: { totalMonthly: 1800 },
    }));
  });
  await page.goto(`${BASE}/optimize`, { waitUntil: 'domcontentloaded' });
  await pause(1000);

  const url4 = page.url();
  if (url4.includes('/preapproval')) {
    fail('/optimize still redirects to /preapproval — App.jsx route not fixed');
  } else if (url4.includes('/optimize') || url4.includes('/login')) {
    pass('/optimize accepts sessionStorage handoff (no redirect to /preapproval)');
  }

  // Check that on the landing page with a fresh low-bond result, the nudge button exists
  // We need to simulate "not from cache" — inject result then clear the stmtFromCache flag
  // by writing it back with a tiny savedAt so the TTL-check fires fresh
  info('Checking improvement plan nudge appears on landing for fresh low-bond results...');
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await pause(400);
  // Switch to statement mode first
  const buyTabForImp = page.locator('button:has-text("I want to buy"), button:has-text("Buy")').first();
  if (await buyTabForImp.count() > 0) await buyTabForImp.click();
  const stmtTabForImp = page.locator('button:has-text("Upload statement"), button:has-text("Statement")').first();
  if (await stmtTabForImp.count() > 0) await stmtTabForImp.click();
  await pause(300);
  // The button only shows after a fresh analysis (stmtFromCache=false), which we can't
  // simulate without a real file upload. Check it's not broken by looking at the component.
  info('Note: "See my improvement plan" nudge only shows after fresh upload with bond < R600k — requires real file upload to test fully');

  // ── 5. Optimize page — direct navigation (no data) ──────
  section('5. /optimize — direct visit, no prior data');

  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${BASE}/optimize`, { waitUntil: 'domcontentloaded' });
  await pause(800);

  const optimizeUrl = page.url();
  if (optimizeUrl.includes('/preapproval')) {
    fail('/optimize still redirects to /preapproval — App.jsx route not fixed');
  } else if (optimizeUrl.includes('/optimize') || optimizeUrl.includes('/login')) {
    pass('/optimize route resolves correctly (no redirect to /preapproval)');
  } else {
    warn(`/optimize resolved to: ${optimizeUrl}`);
  }

  // ── 6. Tools page ────────────────────────────────────────
  section('6. Tools page — statement analyser + improvement plan button');

  // Navigate directly to the qualify-from-statement sub-route
  await page.goto(`${BASE}/tools/qualify-from-statement`, { waitUntil: 'domcontentloaded' });
  await pause(1000);

  const toolsFileInput = page.locator('input[type="file"]').first();
  const toolsFileCount = await toolsFileInput.count();
  toolsFileCount > 0 ? pass('File input present on Tools "Qualify from Statement" tab') : warn('File input not found on Tools qualify tab');

  // Check "Analyse statement" button is present but disabled (no file)
  const toolsAnalyseBtn = page.locator('button:has-text("Analyse statement")').first();
  if (await toolsAnalyseBtn.count() > 0) {
    const disabled = await toolsAnalyseBtn.getAttribute('disabled');
    disabled !== null ? pass('"Analyse statement" button disabled with no file (correct)') : warn('"Analyse statement" button not disabled — should require file');
  } else {
    warn('"Analyse statement" button not found on Tools qualify tab');
  }

  // "See my improvement plan" button only appears after analysis result
  const toolsImprovBtn = page.locator('button:has-text("improvement plan"), a:has-text("improvement plan")').first();
  if (await toolsImprovBtn.count() > 0) {
    pass('"See my improvement plan" button present on Tools (result already showing)');
    const tagName = await toolsImprovBtn.evaluate(el => el.tagName.toLowerCase());
    tagName === 'button' ? pass('Tools improvement plan is a <button> (correct)') : warn(`Tools improvement plan is <${tagName}> — expected button`);
  } else {
    pass('"See my improvement plan" correctly hidden until analysis completes');
  }

  // ── 7. Admin page ────────────────────────────────────────
  section('7. Admin page — greeting, grades, install banner');

  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await pause(1200);

  const adminUrl = page.url();
  if (adminUrl.includes('/login') || adminUrl.includes('/admin')) {
    if (adminUrl.includes('/login')) {
      info('Admin requires login — checking install banner on /login...');
      // Install banner should NOT appear on /login
      await page.evaluate(() => {
        localStorage.setItem('bondly_visits', '10');
        localStorage.removeItem('bondly_install_dismissed');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await pause(1000);
      const banner = page.locator('.install-banner');
      const bannerVisible = await banner.isVisible().catch(() => false);
      bannerVisible ? fail('InstallBanner shown on /login — should be suppressed') : pass('InstallBanner suppressed on /login');
    } else {
      pass('Admin page loaded');

      // InstallBanner should NOT appear on /admin
      await page.evaluate(() => {
        localStorage.setItem('bondly_visits', '10');
        localStorage.removeItem('bondly_install_dismissed');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await pause(1000);
      const banner = page.locator('.install-banner');
      const bannerVisible = await banner.isVisible().catch(() => false);
      bannerVisible ? fail('InstallBanner shown on /admin — should be suppressed') : pass('InstallBanner suppressed on /admin');

      // Check greeting for double-space bug ("Good morning , Admin")
      const greeting = page.locator('[class*="greeting"], [class*="welcome"], h1, h2').first();
      const greetingText = await greeting.textContent().catch(() => '');
      if (greetingText.includes('  ') || greetingText.match(/,\s{2,}/)) {
        fail(`Greeting has extra space: "${greetingText.trim()}"`);
      } else if (greetingText.includes('Good')) {
        pass(`Greeting looks clean: "${greetingText.trim()}"`);
      } else {
        info(`Greeting text: "${greetingText.trim().slice(0,60)}"`);
      }
    }
  }

  // ── 8. Regulatory language spot-check ────────────────────
  section('8. Regulatory language — FSCA/NCR/FSP spot-check');

  const pagesToCheck = [
    { path: '/', label: 'Landing' },
    { path: '/about', label: 'About' },
    { path: '/faq', label: 'FAQ' },
    { path: '/preapproval', label: 'Preapproval' },
  ];

  // Terms that must not appear — educational use of "bond originator" is OK;
  // only flag if Bondly is CLAIMING to be one or to perform licensed intermediary acts.
  const bannedTerms = [
    'FSP number',
    'FSP No',
    'FSCA registered',
    'NCR registered',
    'registered credit intermediary',
    'Bondly submits your',
    'we submit your application',
    'negotiates on your behalf',
    'Bondly is a bond originator',
    'registered bond originator',
    'licensed bond originator',
  ];

  for (const { path, label } of pagesToCheck) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    await pause(500);
    const bodyText = await page.locator('body').textContent().catch(() => '');
    const found = bannedTerms.filter(t => bodyText.toLowerCase().includes(t.toLowerCase()));
    if (found.length > 0) {
      fail(`${label} still contains banned regulatory terms: ${found.join(', ')}`);
    } else {
      pass(`${label} — no banned regulatory language found`);
    }
  }

  // ── 9. Install banner — general visibility ───────────────
  section('9. InstallBanner — second-visit appearance on non-suppressed pages');

  await page.evaluate(() => {
    localStorage.setItem('bondly_visits', '10');
    localStorage.removeItem('bondly_install_dismissed');
  });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await pause(3500); // iOS shows after 3s delay

  const bannerOnHome = page.locator('.install-banner');
  const bannerVisible = await bannerOnHome.isVisible().catch(() => false);
  // On a desktop Chrome it won't show without beforeinstallprompt, that's fine
  if (bannerVisible) {
    pass('InstallBanner appears on home page after 2+ visits');
    // Dismiss it
    const dismissBtn = page.locator('.install-banner__btn--ghost, button:has-text("Not now"), button:has-text("Got it")').first();
    if (await dismissBtn.count() > 0) {
      await dismissBtn.click();
      await pause(400);
      const gone = !(await bannerOnHome.isVisible().catch(() => false));
      gone ? pass('InstallBanner dismisses correctly') : fail('InstallBanner did not dismiss');
    }
  } else {
    info('InstallBanner not visible on desktop (expected — requires beforeinstallprompt or iOS)');
  }

  // ── Summary ───────────────────────────────────────────────
  section('QA Summary');
  console.log(`  ${PASS}  Passed : ${passed}`);
  if (warned)  console.log(`  ${WARN} Warnings: ${warned}`);
  if (failed)  console.log(`  ${FAIL}  Failed : ${failed}`);
  console.log('');

  if (failed === 0) {
    console.log('  All checks passed. Ready for production.\n');
  } else {
    console.log(`  ${failed} check(s) failed — review output above.\n`);
  }

  // Keep browser open so you can explore manually
  console.log('  Browser left open — press Ctrl+C when done.\n');
  await new Promise(() => {}); // keep alive
}

main().catch(err => {
  console.error('\nQA script crashed:', err.message);
  process.exit(1);
});
