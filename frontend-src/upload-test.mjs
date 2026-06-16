/**
 * Statement upload test — tests against both local dev and production.
 * Run: node upload-test.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));

const FIXTURES = [
  { label: 'FNB Salaried',        file: '../playwright-test/fixtures/fnb-salaried.csv' },
  { label: 'Capitec Healthy',     file: '../tests/fixtures/healthy_capitec.csv' },
  { label: 'ABSA Salaried',       file: '../playwright-test/fixtures/absa-salaried.csv' },
];

const TARGETS = [
  { label: 'LOCAL  (localhost:5173)', url: 'http://localhost:5173' },
  { label: 'PROD   (bondly.co.za)',   url: 'https://bondly.co.za' },
];

const fmt = n => n != null ? `R ${Number(n).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}` : '—';

async function pause(ms) { await new Promise(r => setTimeout(r, ms)); }

async function testUpload(page, baseUrl, fixturePath, label) {
  const absPath = path.resolve(__dir, fixturePath);
  console.log(`\n  ► ${label}  (${path.basename(absPath)})`);

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await pause(800);

  // Switch to Buy → Upload statement mode
  const buyBtn = page.locator('button:has-text("Buy a home"), button:has-text("I want to buy"), button:has-text("Buy")').first();
  if (await buyBtn.count()) { await buyBtn.click(); await pause(300); }

  const stmtBtn = page.locator('button:has-text("Upload statement"), button:has-text("Statement")').first();
  if (await stmtBtn.count()) { await stmtBtn.click(); await pause(300); }

  // Clear any cached result
  await page.evaluate(() => localStorage.removeItem('bondly_landing_stmt'));

  // Upload the file via the hidden input
  const fileInput = page.locator('input[type="file"]').first();
  if (!await fileInput.count()) {
    console.log('    ✖  No file input found');
    return null;
  }

  await fileInput.setInputFiles(absPath);
  await pause(400);

  // Click Analyse
  const analyseBtn = page.locator('button:has-text("Analyse statement")').first();
  if (!await analyseBtn.count()) {
    console.log('    ✖  Analyse button not found after file select');
    return null;
  }
  await analyseBtn.click();

  // Wait for result — up to 45s, polling every 500ms
  console.log('    … waiting for analysis result');
  const start = Date.now();
  let result = null;

  while (Date.now() - start < 45000) {
    // Check for error state
    const err = await page.locator('.hero__stmt-error, [class*="stmt-error"]').first().textContent().catch(() => null);
    if (err?.trim()) {
      console.log(`    ✖  Error returned: ${err.trim()}`);
      return { error: err.trim() };
    }

    // Check for result
    const verdict = await page.locator('.hero__afford-verdict').first().textContent().catch(() => null);
    if (verdict) {
      // Scrape all the result fields
      const income  = await page.locator('.hero__result-amount').first().textContent().catch(() => null);
      const bond    = await page.locator('.hero__result-amount').nth(1).textContent().catch(() => null);
      const grade   = await page.locator('.hero__stmt-grade-letter').first().textContent().catch(() => null);
      const dti     = await page.locator('.hero__stmt-grade-dti').first().textContent().catch(() => null);
      const months  = await page.locator('.hero__result-note').first().textContent().catch(() => null);

      result = { verdict: verdict.trim(), income, bond, grade, dti, months };
      break;
    }
    await pause(500);
  }

  if (!result) {
    // Grab whatever text is showing in the result area
    const area = await page.locator('.hero__result, .hero__stmt-upload').first().textContent().catch(() => '');
    console.log(`    ✖  No result after 45s. Area text: "${area?.trim().slice(0, 120)}"`);
    return { timeout: true };
  }

  console.log(`    ✔  Verdict  : ${result.verdict}`);
  console.log(`    ✔  Income   : ${result.income}`);
  console.log(`    ✔  Max bond : ${result.bond}`);
  console.log(`    ✔  Grade    : ${result.grade}  ${result.dti || ''}`);
  console.log(`    ✔  Coverage : ${result.months}`);
  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 60, args: ['--window-size=1400,900'] });
  const ctx     = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page    = await ctx.newPage();

  // Intercept network errors on the page
  page.on('response', res => {
    if (res.url().includes('/api/qualify') || res.url().includes('/api/statement')) {
      const status = res.status();
      if (status >= 400) {
        console.log(`    ⚠  API ${res.status()} on ${res.url()}`);
      }
    }
  });

  const results = {};

  for (const target of TARGETS) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${target.label}`);
    console.log('═'.repeat(60));

    results[target.label] = {};
    for (const fixture of FIXTURES) {
      const r = await testUpload(page, target.url, fixture.file, fixture.label);
      results[target.label][fixture.label] = r;
      await pause(1000);
    }
  }

  // ── Summary table ────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  SUMMARY');
  console.log('═'.repeat(60));
  for (const [env, fixtures] of Object.entries(results)) {
    console.log(`\n  ${env}`);
    for (const [name, r] of Object.entries(fixtures)) {
      if (!r)             { console.log(`    ✖  ${name} — no result`); continue; }
      if (r.error)        { console.log(`    ✖  ${name} — ERROR: ${r.error}`); continue; }
      if (r.timeout)      { console.log(`    ✖  ${name} — TIMEOUT`); continue; }
      console.log(`    ✔  ${name} → ${r.verdict} | income ${r.income} | bond ${r.bond}`);
    }
  }

  console.log('\n  Browser left open — press Ctrl+C when done.\n');
  await new Promise(() => {});
}

main().catch(e => { console.error('Crash:', e.message); process.exit(1); });
