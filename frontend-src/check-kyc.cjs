const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('ERROR:', e.message));
  await page.goto('http://localhost:5173/login');
  await page.fill('#loginEmail', 'test@test.com');
  await page.fill('#loginPw', 'test1234');
  await page.locator('form.auth-form button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/kyc-dashboard.png', fullPage: false });
  // Go to profile
  await page.goto('http://localhost:5173/profile');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/kyc-profile-account.png' });
  // Click identity tab
  await page.click('button:has-text("Verify identity")');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/kyc-profile-identity.png', fullPage: true });
  // Type a valid SA ID
  await page.fill('.kyc-id-input', '8001015009087');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/kyc-id-filled.png', fullPage: true });
  console.log('Done');
  await browser.close();
})();
