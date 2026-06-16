import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newContext().then(c => c.newPage());
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

// 1. Login
await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
await page.fill('input[type="email"]', 'admin@bondly.co.za');
await page.fill('input[type="password"]', 'admin123');
await page.click('button[type="submit"]');
await page.waitForTimeout(2000);
console.log('Login URL:', page.url());

// 2. Test intelligence/sectors endpoint directly
const sectorsRes = await page.evaluate(async token => {
  const r = await fetch('http://localhost:3000/api/me/intelligence/sectors', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return r.json();
}, await page.evaluate(() => localStorage.getItem('token') || sessionStorage.getItem('token') || ''));
console.log('Sectors count:', sectorsRes?.sectors?.length, '| first:', sectorsRes?.sectors?.[0]);

// 3. Test intelligence/profile endpoint
const profileRes = await page.evaluate(async token => {
  const r = await fetch('http://localhost:3000/api/me/intelligence/profile', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return r.json();
}, await page.evaluate(() => localStorage.getItem('token') || sessionStorage.getItem('token') || ''));
console.log('Profile:', profileRes);

// 4. Test bank intelligence endpoint (should have lat/lng now)
const bankToken = 'dummy'; // won't auth but tests endpoint shape
const bankRes = await page.evaluate(async () => {
  const r = await fetch('http://localhost:3000/api/bank/intelligence');
  return { status: r.status };
});
console.log('Bank intelligence status (no auth):', bankRes.status, '(401 expected)');

// 5. Navigate to dashboard finances tab
await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle', timeout: 10000 });
await page.waitForTimeout(1500);
// Click the Finances or Score tab
const finTab = await page.$('[data-tab="health"], button:has-text("Score"), button:has-text("Readiness")');
if (finTab) { await finTab.click(); await page.waitForTimeout(1000); }
const profileCard = await page.$('.rsc-profile-card');
console.log('Profile correction card visible:', !!profileCard);

console.log('Console errors:', errors.length ? errors : 'none');
await browser.close();
console.log('--- DONE ---');
