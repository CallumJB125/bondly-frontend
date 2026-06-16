const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/login');
  await page.fill('#loginEmail', 'test@test.com');
  await page.fill('#loginPw', 'test1234');
  await page.locator('form.auth-form button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
  await page.waitForTimeout(2000);
  await page.click('.dash-tab:has-text("My Bonds")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/bondly-bonds-fixed.png', fullPage: true });
  await page.click('.dash-tab:has-text("Switch")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/bondly-switch-fixed.png', fullPage: true });
  console.log('Done');
  await browser.close();
})();
