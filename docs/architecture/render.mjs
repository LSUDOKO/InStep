// Renders the settled architecture diagram:  node docs/architecture/render.mjs [seconds]
// → architecture.png (1920×1080 rendered at 2x, downscaled to 2400 px wide) and gate-sequence.png (panel close-up).
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
await page.goto(`file://${dir}architecture.html`);
await page.evaluate(() => document.fonts.ready);
const t = Number(process.argv[2] ?? (await page.evaluate(() => window.SETTLED + 1)));
await page.evaluate((s) => window.seek(s), t);

const raw = `${dir}.architecture@2x.png`;
await page.screenshot({ path: raw });
await page.locator('#seq').screenshot({ path: `${dir}gate-sequence.png` });
await browser.close();

// ImageMagick: Lanczos downscale + palette quantisation keeps the flat illustration crisp and small.
execFileSync('magick', [
  raw,
  '-resize',
  '2400x',
  '-strip',
  '-colors',
  '256',
  '+dither',
  `${dir}architecture.png`,
]);
execFileSync('magick', [
  `${dir}gate-sequence.png`,
  '-strip',
  '-colors',
  '256',
  '+dither',
  `${dir}gate-sequence.png`,
]);
execFileSync('rm', [raw]);
for (const f of ['architecture.png', 'gate-sequence.png'])
  console.log(`wrote ${dir}${f} (${Math.round(statSync(dir + f).size / 1024)} KB) at t=${t}s`);
