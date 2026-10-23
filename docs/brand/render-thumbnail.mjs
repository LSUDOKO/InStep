// Renders docs/brand/thumbnail.html to thumbnail.png (1500×1000, 3:2):  node docs/brand/render-thumbnail.mjs
import { createRequire } from 'node:module';

const { chromium } = createRequire(new URL('../../apps/companion/package.json', import.meta.url))(
  '@playwright/test',
);
const dir = new URL('./', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(`file://${dir}thumbnail.html`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}thumbnail@2x.png` });
await browser.close();
console.log('rendered');
