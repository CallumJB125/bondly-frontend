import { chromium } from './node_modules/playwright/index.mjs';

const BASE = 'http://localhost:5174';
const browser = await chromium.launch({ headless: false, slowMo: 300 });
const page = await browser.newPage();
page.on('console', m => m.type() === 'error' && console.log('JS ERR:', m.text()));

await page.goto(BASE + '/bank/login');
await page.fill('input[type="email"]', 'demo@bondly.co.za');
await page.fill('input[type="password"]', 'demo123');
await page.click('button[type="submit"]');
await page.waitForURL('**/bank/**', { timeout: 5000 });
console.log('✓ Login —', page.url());

for (const [name, url, checks] of [
  ['Applications', '/bank/applications', async p => ({
    'risk chips': await p.locator('button:has-text("Green")').count(),
    'LTV filter': await p.locator('label:has-text("Max LTV")').count(),
    'expiry countdown': await p.locator('text=Expires').count(),
  })],
  ['Bids', '/bank/bids', async p => ({
    'win rate stat': await p.locator('text=Win rate').count(),
    'expired tab': await p.locator('button:has-text("Expired")').count(),
  })],
  ['Deals', '/bank/deals', async p => ({
    'portfolio health': await p.locator('text=Portfolio health').count(),
  })],
  ['Analytics', '/bank/analytics', async p => ({
    'SVG polylines': await p.locator('svg polyline').count(),
  })],
  ['Triage', '/bank/triage', async p => ({
    'withdraw btn': await p.locator('button:has-text("Withdraw")').count(),
  })],
  ['AutoBid', '/bank/auto-bid', async p => ({
    'preview btn': await p.locator('text=Preview last 30 days').count(),
  })],
  ['Settings', '/bank/settings', async p => ({
    'rate chart': await p.locator('text=Rate visualisation').count(),
  })],
  ['Intelligence', '/bank/intelligence', async p => ({
    'trends tab': await p.locator('button:has-text("Trends")').count(),
    'period slider': await p.locator('input[type="range"]').count(),
  })],
]) {
  await page.goto(BASE + url);
  await page.waitForTimeout(1800);
  const results = await checks(page);
  const line = Object.entries(results).map(([k,v]) => `${k}:${v}`).join(' | ');
  console.log(`${Object.values(results).every(v=>v>0)?'✓':'⚠'} ${name} — ${line}`);
}

// Trends tab deep check
await page.goto(BASE + '/bank/intelligence');
await page.waitForTimeout(2000);
if (await page.locator('button:has-text("Trends")').count() > 0) {
  await page.click('button:has-text("Trends")');
  await page.waitForTimeout(1500);
  console.log('✓ Trends tab — SVG lines:', await page.locator('svg polyline').count(),
    '| compare:', await page.locator('button:has-text("Compare")').count(),
    '| movers:', await page.locator('text=Biggest Suburb Movers').count());
  
  // Test compare mode
  await page.click('button:has-text("Compare")');
  await page.waitForTimeout(800);
  const selects = await page.locator('select').count();
  console.log('✓ Compare mode — period selects:', selects);
}

await browser.close();
console.log('\n✅ All checks complete');
