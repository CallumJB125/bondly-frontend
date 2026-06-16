import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 350 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// 1. Landing — switch tab, check H1, no FSCA
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/r01_landing_switch.png' });

// 2. Landing — scroll down to testimonials
await page.evaluate(() => window.scrollTo({ top: 2800, behavior: 'smooth' }));
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/r02_testimonials.png' });

// 3. Scroll to sticky CTA area (should be visible past hero)
await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'smooth' }));
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/r03_sticky_cta.png' });

// 4. /switch page — form view
await page.goto('http://localhost:5173/switch', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/r04_switch_form.png' });

// 5. /switch/demo — verdict view (no form, straight to results)
await page.goto('http://localhost:5173/switch/demo', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/r05_switch_demo.png' });

// 6. Expand a "How we got this" on demo verdict
const howBtn = page.locator('.switch-verdict__how').first();
if (await howBtn.count()) { await howBtn.click(); await page.waitForTimeout(400); }
await page.screenshot({ path: '/tmp/r06_switch_how.png' });

// 7. Scroll down to bank table on demo
await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/r07_switch_banks.png' });

// 8. FAQ page — check padding, chevron
await page.goto('http://localhost:5173/faq', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/r08_faq.png' });

// 9. Click an FAQ item to expand
await page.locator('.faq-item__q').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/r09_faq_open.png' });

// 10. Nav logged out — should see phone number
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/r10_nav_phone.png' });

// 11. Consent pill — clear localStorage, reload
await page.evaluate(() => { localStorage.removeItem('bondly_consent'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/r11_consent_pill.png' });

// 12. About page — check no "negotiate" marketing language
await page.goto('http://localhost:5173/about', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/r12_about.png' });

await browser.close();
console.log('Review complete — screenshots at /tmp/r01_*.png through r12_*.png');
