const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/login');
  await page.fill('#loginEmail', 'test@test.com');
  await page.fill('#loginPw', 'test1234');
  await page.locator('form.auth-form button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
  await page.waitForTimeout(2500);
  
  // Overview
  await page.screenshot({ path: '/tmp/final-overview.png', fullPage: true });
  
  // Check for console errors
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  
  await page.click('.dash-tab:has-text("My Bonds")'); await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/final-bonds.png', fullPage: true });
  
  await page.click('.dash-tab:has-text("Switch")'); await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/final-switch.png', fullPage: true });
  
  await page.click('.dash-tab:has-text("Payments")'); await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/final-payments.png', fullPage: true });
  
  if (errors.length) console.log('JS ERRORS:', errors);
  else console.log('No JS errors detected.');
  console.log('Done — screenshots saved to /tmp/final-*.png');
  await browser.close();
})();
