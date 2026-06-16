const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('#loginEmail', 'test@test.com');
  await page.fill('#loginPw', 'test1234');
  await page.locator('form.auth-form button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
  await page.waitForTimeout(2000); // let data load
  
  // Grab swap banner text
  const banner = await page.locator('.swap-opportunity-card, .swap-opp__heading').first().textContent().catch(() => 'NOT FOUND');
  console.log('Swap banner:', banner);
  
  // Grab stats
  const stats = await page.locator('.stat-card, .dash-stat').allTextContents().catch(() => []);
  console.log('Stats:', stats);
  
  // Bond health ring score
  const ring = await page.locator('.bhr-score, .health-ring text, [class*="ring"] text').first().textContent().catch(() => 'NOT FOUND');
  console.log('Ring score:', ring);
  
  await page.screenshot({ path: '/tmp/bondly-fresh-overview.png', fullPage: false });
  
  await browser.close();
})();
