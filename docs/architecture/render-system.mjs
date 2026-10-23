// Renders the settled system diagram:  node docs/architecture/render-system.mjs [seconds]
// → system-diagram.png (1920×1080 rendered at 2x, downscaled to 2400 px wide).
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright is a companion dev dependency; resolve it from there.
const { chromium } = createRequire(new URL('../../apps/companion/package.json', import.meta.url))(
  '@playwright/test',
);

const dir = new URL('./', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await page.goto(`file://${dir}system-diagram.html`);
await page.evaluate(() => document.fonts.ready);
const t = Number(process.argv[2] ?? (await page.evaluate(() => window.SETTLED)));
await page.evaluate((s) => window.seek(s), t);

const raw = `${dir}.system-diagram@2x.png`;
await page.screenshot({ path: raw });
await browser.close();

// ImageMagick: Lanczos downscale + palette quantisation keeps the flat diagram crisp and small.
execFileSync('magick', [
  raw,
  '-resize',
  '2400x',
  '-strip',
  '-colors',
  '256',
  '+dither',
  `${dir}system-diagram.png`,
]);
execFileSync('rm', [raw]);
console.log(
  `wrote ${dir}system-diagram.png (${Math.round(statSync(`${dir}system-diagram.png`).size / 1024)} KB) at t=${t}s`,
);
