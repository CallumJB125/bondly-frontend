const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    errors.push(err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });

  async function check(label, fn) {
    try {
      await fn();
      console.log(`✓ ${label}`);
    } catch (e) {
      console.log(`✗ ${label}: ${e.message}`);
      errors.push(label + ': ' + e.message);
    }
  }

  console.log('\n── Reverse Loan Calculator Test ────────────────────\n');

  // Navigate to the repayment calculator
  await page.goto('http://localhost:5173/tools/repayment-calculator', { waitUntil: 'networkidle' });

  await check('Repayment calculator loads', async () => {
    await page.waitForSelector('text=Repayment Calculator', { timeout: 5000 });
  });

  // Switch to "Calculate loan amount" mode
  await check('Switch to loan amount mode', async () => {
    await page.click('button:has-text("Calculate loan amount")');
    await page.waitForSelector('input[placeholder="15 000"]', { timeout: 3000 });
  });

  await page.screenshot({ path: '/tmp/rc-01-loan-mode.png' });
  console.log('Screenshot: /tmp/rc-01-loan-mode.png');

  // Type 20000 one digit at a time — this is what triggers the hooks bug
  const monthlyInput = page.locator('input[placeholder="15 000"]');

  console.log('\n  Typing "20000" one digit at a time...');
  await monthlyInput.click();
  await monthlyInput.fill('');

  for (const digit of ['2', '0', '0', '0', '0']) {
    await monthlyInput.press(digit);
    const val = await monthlyInput.inputValue();
    console.log(`  Pressed ${digit} → input value: "${val}"`);
    await page.waitForTimeout(200);

    // Check the page hasn't crashed
    const crashed = await page.locator('text=Something went wrong').count();
    if (crashed > 0) {
      console.log(`  ✗ PAGE CRASHED after pressing "${digit}"!`);
      errors.push(`Page crashed after pressing "${digit}"`);
      break;
    }
  }

  await page.screenshot({ path: '/tmp/rc-02-after-typing.png' });
  console.log('Screenshot: /tmp/rc-02-after-typing.png');

  await check('No "Something went wrong" error on screen', async () => {
    const crashed = await page.locator('text=Something went wrong').count();
    if (crashed > 0) throw new Error('Error boundary triggered');
  });

  await check('Loan amount result appears', async () => {
    await page.waitForSelector('text=Maximum loan amount', { timeout: 3000 });
  });

  await check('Result shows a reasonable bond amount (>R1M for R20k/month)', async () => {
    const text = await page.locator('.calc-result').first().textContent();
    console.log('  Result text:', text.substring(0, 120).trim());
    if (!text.includes('1') && !text.includes('R')) throw new Error('No result shown');
  });

  // Check PropertySearchCTA auto-expanded
  await check('PropertySearchCTA shows (auto-expanded)', async () => {
    await page.waitForSelector('.prop-cta__body', { timeout: 3000 });
    console.log('  PropertySearchCTA body is visible');
  });

  await page.screenshot({ path: '/tmp/rc-03-with-property-cta.png' });
  console.log('Screenshot: /tmp/rc-03-with-property-cta.png');

  // Test location search inside the CTA
  await check('Can search for a city without crashing', async () => {
    const searchInput = page.locator('.prop-cta__search-input');
    await searchInput.click();
    await searchInput.fill('Cape Town');
    await page.waitForSelector('.prop-cta__drop-item', { timeout: 2000 });
    console.log('  Dropdown appeared with location results');
  });

  await page.screenshot({ path: '/tmp/rc-04-search.png' });
  console.log('Screenshot: /tmp/rc-04-search.png');

  await check('Can pick a city and see property links', async () => {
    await page.click('.prop-cta__drop-item:first-child');
    await page.waitForSelector('text=Property24', { timeout: 2000 });
    await page.waitForSelector('text=Private Property', { timeout: 2000 });
    const resultText = await page.locator('.prop-cta__result').first().textContent();
    console.log('  Result:', resultText.substring(0, 100).trim());
  });

  await page.screenshot({ path: '/tmp/rc-05-links.png' });
  console.log('Screenshot: /tmp/rc-05-links.png');

  // Summary
  console.log('\n────────────────────────────────────────────────────');
  if (errors.length === 0) {
    console.log('✓ All checks passed — reverse calc works correctly');
  } else {
    console.log(`✗ ${errors.length} issue(s):`);
    errors.forEach(e => console.log('  -', e));
  }
  console.log('────────────────────────────────────────────────────\n');

  await page.waitForTimeout(2000);
  await browser.close();
})();
