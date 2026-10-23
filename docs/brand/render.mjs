// Renders docs/brand/brand-board.html to brand-board.png:  node docs/brand/render.mjs
import { createRequire } from 'node:module';

// Playwright is a companion dev dependency; resolve it from there.
const { chromium } = createRequire(new URL('../../apps/companion/package.json', import.meta.url))(
  '@playwright/test',
);

const dir = new URL('./', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 880 }, deviceScaleFactor: 2 });
await page.goto(`file://${dir}brand-board.html`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${dir}brand-board.png` });
await browser.close();
console.log(`wrote ${dir}brand-board.png`);
