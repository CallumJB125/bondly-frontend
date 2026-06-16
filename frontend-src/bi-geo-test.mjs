import { chromium } from './node_modules/playwright/index.mjs';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto('http://localhost:5173/bank/intelligence');
const res = await page.evaluate(async () => {
  const r = await fetch('/api/bank/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'demo@bondly.co.za',password:'demo123'}) });
  return r.json();
});
await page.evaluate(t => localStorage.setItem('bondly_bank_token', t), res?.data?.token || res?.token);
await page.goto('http://localhost:5173/bank/intelligence');
await page.waitForFunction(() => document.querySelector('button.bi-tab-btn') !== null, { timeout: 15000 });
const tabs = await page.$$('button.bi-tab-btn');
for (const tab of tabs) { if ((await tab.textContent()).includes('Geo')) { await tab.click(); break; } }
// Wait for leaflet.heat CDN to load and render
await page.waitForTimeout(4000);
await page.screenshot({ path: '/tmp/geo-risk-tab.png', fullPage: false });
console.log('done');
await browser.close();
