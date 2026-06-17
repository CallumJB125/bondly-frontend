#!/usr/bin/env node
/**
 * Visual verification screenshots via Puppeteer.
 *
 * Captures full-page screenshots of one or more routes at multiple viewports
 * (mobile + large by default) so design changes can be checked at both ends of
 * the responsive range. Replaces the old ad-hoc Playwright scripts.
 *
 * Prerequisite: the dev server must already be running (npm run dev -> :5173).
 *
 * Usage:
 *   npm run shot                       # captures "/" at mobile + large
 *   npm run shot -- / /dashboard       # multiple routes
 *   npm run shot -- / --all            # mobile + large + xl
 *   npm run shot -- /compare --mobile  # a single viewport
 *   npm run shot -- / --base=http://localhost:5174   # the origination app
 *   npm run shot -- / --out=.screenshots/before      # custom output folder
 *
 * Flags:
 *   --mobile --large --xl     pick specific viewports (default: mobile + large)
 *   --all                     all three viewports
 *   --base=<url>              base URL (default http://localhost:5173, env BASE_URL)
 *   --out=<dir>               output dir (default .screenshots)
 *   --viewport               (no scroll) capture only the visible viewport, not full page
 */

import puppeteer from 'puppeteer';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  large: { width: 1440, height: 900, deviceScaleFactor: 1 },
  xl: { width: 1920, height: 1080, deviceScaleFactor: 1 },
};

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')));
const opts = Object.fromEntries(
  args
    .filter((a) => a.startsWith('--') && a.includes('='))
    .map((a) => a.slice(2).split('=')),
);

const routes = args.filter((a) => !a.startsWith('--'));
if (routes.length === 0) routes.push('/');

const baseUrl = (opts.base || process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const outDir = path.resolve(process.cwd(), opts.out || '.screenshots');
const fullPage = !flags.has('--viewport');

let selected = ['mobile', 'large', 'xl'].filter((v) => flags.has(`--${v}`));
if (flags.has('--all')) selected = ['mobile', 'large', 'xl'];
if (selected.length === 0) selected = ['mobile', 'large'];

const slug = (route) => {
  const s = route.replace(/^\//, '').replace(/\/$/, '').replace(/[^a-z0-9]+/gi, '-');
  return s || 'home';
};

async function run() {
  await mkdir(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const saved = [];

  try {
    for (const route of routes) {
      for (const name of selected) {
        const page = await browser.newPage();
        await page.setViewport(VIEWPORTS[name]);
        const url = `${baseUrl}${route.startsWith('/') ? route : `/${route}`}`;
        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
          // let fonts/animations settle
          await new Promise((r) => setTimeout(r, 600));
          const file = path.join(outDir, `${slug(route)}-${name}.png`);
          await page.screenshot({ path: file, fullPage });
          saved.push(file);
          console.log(`✓ ${name.padEnd(6)} ${url} -> ${path.relative(process.cwd(), file)}`);
        } catch (err) {
          console.error(`✗ ${name.padEnd(6)} ${url} -> ${err.message}`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (saved.length === 0) {
    console.error('\nNo screenshots captured. Is the dev server running? (npm run dev)');
    process.exit(1);
  }
  console.log(`\n${saved.length} screenshot(s) in ${path.relative(process.cwd(), outDir)}/`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
