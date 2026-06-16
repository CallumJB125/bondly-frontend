/**
 * Bondly PDF Parser Test — v3
 *
 * Architecture:
 *   1. Navigate to /preapproval → click Continue (step 0 → step 1)
 *   2. setInputFiles to trigger file upload → captures jobId from API response
 *   3. Poll /api/qualify/job/:jobId directly from Node.js every 3s (up to 8 min)
 *   4. Record full result from job API response (income, txns, bank, zone, etc.)
 *   5. Take screenshots at each stage + full-page at end
 *
 * Key fixes vs v2:
 *   - No longer relies on waitForFunction (hit Playwright's 30s default timeout)
 *   - Polls job API directly from Node.js instead of watching the DOM
 *   - Properly captures "done" status response which contains the full result
 */

import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'fs';

const BASE = 'https://bondly.co.za';

const slug = s => s.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
const ss   = (page, name) => page.screenshot({ path: `/tmp/parse_${slug(name)}.png`, fullPage: false }).catch(() => {});
const wait = ms => new Promise(r => setTimeout(r, ms));

const STATEMENTS = [
  {
    label: 'Capitec Feb–May 2026 (image PDF)',
    path: '/Users/callumbaker/Downloads/account_statement_1-Feb-2026_to_10-May-2026.pdf',
    expectedBank: 'Capitec',
    notes: 'Most recent statement — primary income source. Image PDF, requires OCR.',
  },
  {
    label: 'Capitec Apr–May 2024',
    path: '/Users/callumbaker/Downloads/account_statement_1-Apr-2024_to_3-May-2024.pdf',
    expectedBank: 'Capitec',
    notes: '1-month window, older.',
  },
  {
    label: 'Capitec Nov 2023–May 2024 (6 months)',
    path: '/Users/callumbaker/Library/Mobile Documents/com~apple~CloudDocs/Downloads/account_statement_1-Nov-2023_to_14-May-2024.pdf',
    expectedBank: 'Capitec',
    notes: 'Long period — income averaging most accurate here.',
  },
  {
    label: 'Capitec Sep–Dec 2024',
    path: '/Users/callumbaker/Library/Mobile Documents/com~apple~CloudDocs/account_statement_1-Sep-2024_to_12-Dec-2024.pdf',
    expectedBank: 'Capitec',
    notes: '3-month window.',
  },
  {
    label: 'Capitec Feb–Mar 2024',
    path: '/Users/callumbaker/Library/Mobile Documents/com~apple~CloudDocs/Downloads/account_statement_25-Feb-2024_to_20-Mar-2024.pdf',
    expectedBank: 'Capitec',
    notes: 'Short 1-month window.',
  },
  {
    label: 'Capitec pre-transfer savings',
    path: '/Users/callumbaker/Library/Mobile Documents/com~apple~CloudDocs/Statement pre transfer.pdf',
    expectedBank: 'Capitec',
    notes: 'Savings account (204), around bond switch period.',
  },
  {
    label: 'Oliver dummy (OpenPDF, image)',
    path: '/Users/callumbaker/Library/Mobile Documents/com~apple~CloudDocs/Oliver dummy statement.pdf',
    expectedBank: 'Unknown',
    notes: 'Generated dummy — stress test for unrecognised format.',
  },
];

// Poll /api/qualify/job/:jobId from Node.js until done/failed or 8-minute deadline
async function pollJob(jobId) {
  const deadline = Date.now() + 8 * 60 * 1000;
  let attempt = 0;
  while (Date.now() < deadline) {
    await wait(3000);
    attempt++;
    const resp = await fetch(`${BASE}/api/qualify/job/${jobId}`);
    const json = await resp.json();
    if (!json.success) throw new Error(json.error || 'Job failed');
    const { status, result, error } = json.data;
    if (status === 'done')   return result;
    if (status === 'failed') throw new Error(error || 'Statement analysis failed');
    process.stdout.write(`   · poll ${attempt} (${Math.round((Date.now() - (deadline - 8*60*1000))/1000)}s)...\r`);
  }
  throw new Error('Timed out after 8 minutes');
}

const results = [];
const browser = await chromium.launch({ headless: false, slowMo: 80 });

for (const stmt of STATEMENTS) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`▶  ${stmt.label}`);
  console.log(`   ${stmt.path}`);
  console.log(`${'─'.repeat(70)}`);

  if (!existsSync(stmt.path)) {
    console.log('   ✗ File not found — skipping');
    results.push({ label: stmt.label, error: 'File not found', expectedBank: stmt.expectedBank, notes: stmt.notes });
    continue;
  }

  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000); // 60s for UI interactions

  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(`PageError: ${e.message}`));

  // Capture the submission response to get jobId
  let capturedJobId = null;
  let willOcr = false;
  page.on('response', async resp => {
    if (!resp.url().includes('/api/qualify/from-statement')) return;
    try {
      const body = await resp.json();
      if (body?.data?.jobId) {
        capturedJobId = body.data.jobId;
        willOcr = !!body.data.willOcr;
      }
    } catch { /* ignore */ }
  });

  const result = {
    label:          stmt.label,
    expectedBank:   stmt.expectedBank,
    notes:          stmt.notes,
    willOcr:        null,
    incomeDetected: false,
    incomeAmount:   null,
    txnCount:       null,
    zone:           null,
    score:          null,
    maxBond:        null,
    empType:        null,
    bank:           null,
    monthsOfData:   null,
    durationMs:     null,
    jobId:          null,
    error:          null,
    consoleErrors:  [],
    jobResult:      null,
  };

  try {
    // ── 1. Navigate to /preapproval ──────────────────────────────────────────
    await page.goto(`${BASE}/preapproval`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate(() => localStorage.setItem('bondly_consent', '1'));
    await wait(600);
    await ss(page, `${stmt.label}_01_step0`);

    // ── 2. Advance from step 0 → step 1 (click Continue) ────────────────────
    const continueBtn = page.locator(
      'button:has-text("Continue"), button:has-text("Next"), button[type="submit"]'
    ).first();
    if (await continueBtn.count()) {
      await continueBtn.click();
      console.log('   → Clicked Continue (step 0 → step 1)');
      await wait(800);
    }
    await ss(page, `${stmt.label}_02_step1`);

    // ── 3. Upload the file ───────────────────────────────────────────────────
    // Hidden file inputs are fine for setInputFiles — no visibility check needed
    const fileInput = page.locator('input[type="file"]').first();
    if (!(await fileInput.count())) throw new Error('No file input found on step 1');

    const t0 = Date.now();
    await fileInput.setInputFiles(stmt.path);
    console.log('   → File uploaded — waiting for jobId...');
    await wait(500);
    await ss(page, `${stmt.label}_03_uploading`);

    // ── 4. Wait for jobId from submission response ───────────────────────────
    const jobWaitDeadline = Date.now() + 15000;
    while (!capturedJobId && Date.now() < jobWaitDeadline) {
      await wait(200);
    }
    if (!capturedJobId) throw new Error('No jobId received within 15s — upload may have failed');

    result.jobId   = capturedJobId;
    result.willOcr = willOcr;
    console.log(`   → Job submitted: ${capturedJobId} (OCR: ${willOcr})`);

    // ── 5. Poll job API directly from Node.js until complete ─────────────────
    console.log('   → Polling job status...');
    const jobResult = await pollJob(capturedJobId);
    result.durationMs = Date.now() - t0;
    console.log(`\n   → Job complete in ${(result.durationMs / 1000).toFixed(1)}s`);

    result.jobResult = jobResult;

    // ── 6. Extract structured data from job result ───────────────────────────
    if (jobResult) {
      // Income
      const income = jobResult.monthlyIncome ?? jobResult.income ?? jobResult.detectedIncome;
      if (income != null && income > 0) {
        result.incomeDetected = true;
        result.incomeAmount   = income;
      }

      // Transactions
      if (jobResult.transactions?.length) result.txnCount = jobResult.transactions.length;

      // Bank
      if (jobResult.bank) result.bank = jobResult.bank;

      // Employment type
      if (jobResult.employmentType || jobResult.empType) result.empType = jobResult.employmentType || jobResult.empType;

      // Months of data
      if (jobResult.monthsOfData != null) result.monthsOfData = jobResult.monthsOfData;

      // Qualification
      const qual = jobResult.qualification || jobResult;
      if (qual.zone || qual.affordabilityZone) result.zone = qual.zone || qual.affordabilityZone;
      if (qual.maxBond) result.maxBond = qual.maxBond;
      if (qual.score != null) result.score = qual.score;
    }

    result.consoleErrors = consoleErrors;

    // ── 7. Take final UI screenshot ──────────────────────────────────────────
    await wait(1200);
    await ss(page, `${stmt.label}_04_result`);
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await wait(400);
    await page.screenshot({
      path: `/tmp/parse_${slug(stmt.label)}_full.png`,
      fullPage: true,
    });

    // ── 8. Console output ────────────────────────────────────────────────────
    const fmtR = n => n != null ? `R ${Number(n).toLocaleString('en-ZA')}` : '—';
    console.log(`   Income:  ${result.incomeAmount != null ? fmtR(result.incomeAmount) : '—'}`);
    console.log(`   Zone:    ${result.zone    || '—'}`);
    console.log(`   Bond:    ${result.maxBond != null ? fmtR(result.maxBond) : '—'}`);
    console.log(`   Score:   ${result.score   != null ? result.score + '/100' : '—'}`);
    console.log(`   Txns:    ${result.txnCount || '—'}`);
    console.log(`   Bank:    ${result.bank    || '—'}`);
    console.log(`   EmpType: ${result.empType || '—'}`);
    console.log(`   Months:  ${result.monthsOfData ?? '—'}`);
    console.log(`   OCR:     ${result.willOcr}`);
    if (consoleErrors.length) console.log(`   Errs:    ${consoleErrors[0]}`);

  } catch (err) {
    result.error         = err.message;
    result.consoleErrors = consoleErrors;
    result.durationMs    = result.durationMs ?? -1;
    console.log(`\n   ✗ Error: ${err.message}`);
    await ss(page, `${stmt.label}_error`);
  }

  results.push(result);
  await ctx.close();
  await wait(1500);
}

await browser.close();

// ── Summary ────────────────────────────────────────────────────────────────────
const fmtR = n => n != null ? `R ${Number(n).toLocaleString('en-ZA')}` : null;

console.log('\n\n' + '═'.repeat(70));
console.log('RESULTS SUMMARY');
console.log('═'.repeat(70));

for (const r of results) {
  const status = r.error
    ? '✗ ERROR'
    : r.incomeDetected
      ? '✓ INCOME'
      : '⚠ NO INCOME';

  console.log(`\n${status} — ${r.label}`);
  console.log(`  Expected bank: ${r.expectedBank}`);
  if (r.error)                          console.log(`  Error:    ${r.error}`);
  if (r.incomeAmount != null)           console.log(`  Income:   ${fmtR(r.incomeAmount)}`);
  if (r.zone)                           console.log(`  Zone:     ${r.zone}`);
  if (r.maxBond != null)                console.log(`  Bond:     ${fmtR(r.maxBond)}`);
  if (r.score != null)                  console.log(`  Score:    ${r.score}/100`);
  if (r.txnCount)                       console.log(`  Txns:     ${r.txnCount}`);
  if (r.monthsOfData != null)           console.log(`  Months:   ${r.monthsOfData}`);
  if (r.bank)                           console.log(`  Bank:     ${r.bank}`);
  if (r.empType)                        console.log(`  EmpType:  ${r.empType}`);
  if (r.willOcr != null)                console.log(`  OCR:      ${r.willOcr}`);
  if (r.durationMs && r.durationMs > 0) console.log(`  Time:     ${(r.durationMs / 1000).toFixed(1)}s`);
  if (r.jobId)                          console.log(`  JobID:    ${r.jobId}`);
  if (r.consoleErrors?.length)          console.log(`  Console:  ${r.consoleErrors[0]}`);
  console.log(`  Notes:    ${r.notes}`);
}

writeFileSync('/tmp/parse_results.json', JSON.stringify(results, null, 2));
console.log('\n\nFull results → /tmp/parse_results.json');
console.log('Screenshots  → /tmp/parse_*.png');
