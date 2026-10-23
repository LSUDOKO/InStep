// Renders a brand sheet to PNG at 2x:  node docs/brand/render.mjs [brand-board|directions]
import { createRequire } from 'node:module';

// Playwright is a companion dev dependency; resolve it from there.
const { chromium } = createRequire(new URL('../../apps/companion/package.json', import.meta.url))(
  '@playwright/test',
);

const name = process.argv[2] ?? 'brand-board';
const dir = new URL('./', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 880 }, deviceScaleFactor: 2 });
await page.goto(`file://${dir}${name}.html`);
await page.evaluate(() => document.fonts.ready);
const { width, height } = await page.evaluate(() => document.body.getBoundingClientRect());
await page.setViewportSize({ width: Math.ceil(width), height: Math.ceil(height) });
await page.screenshot({ path: `${dir}${name}.png` });
await browser.close();
console.log(`wrote ${dir}${name}.png`);
