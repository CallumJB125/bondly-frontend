const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/login-showpw.png' });
  // Toggle show password
  await page.fill('#loginEmail', 'test@test.com');
  await page.fill('#loginPw', 'test1234');
  await page.click('.auth-pw-toggle');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/login-showpw-revealed.png' });
  // Check register tab
  await page.click('.auth-tabs button:nth-child(2)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/register-showpw.png' });
  console.log('Done');
  await browser.close();
})();
