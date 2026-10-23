// InStep mark: a foot sole that is also a pause bar, next to a play triangle — "the video that waits for you".
// Flat, outline-free; each shape casts a short 45° long shadow. Writes apps/companion/public/logo.svg and prints
// the path data used by apps/tv/src/components/Logo.tsx.   node docs/brand/logo.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const pal = JSON.parse(readFileSync(new URL('./palette.json', import.meta.url)));
const TILE = pal.surface2;
const SHADOW = pal.surface;
const SOLE = pal.primary;
const PLAY = pal.accents.sun;
const L = 7; // shadow length along (1, 1)

const r1 = (n) => Math.round(n * 100) / 100;
const pathOf = (pts) => 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z';
const circle = (cx, cy, r, n = 48) =>
  Array.from({ length: n }, (_, i) => [
    cx + r * Math.cos((2 * Math.PI * i) / n),
    cy + r * Math.sin((2 * Math.PI * i) / n),
  ]);
/** Triangle with rounded corners (radius r), sampled. */
function roundTri(v, r) {
  const pts = [];
  for (let i = 0; i < 3; i++) {
    const [p, a, b] = [v[i], v[(i + 2) % 3], v[(i + 1) % 3]];
    const ua = norm([a[0] - p[0], a[1] - p[1]]),
      ub = norm([b[0] - p[0], b[1] - p[1]]);
    const half = Math.acos(ua[0] * ub[0] + ua[1] * ub[1]) / 2;
    const d = r / Math.tan(half); // tangent distance from the corner
    const bis = norm([ua[0] + ub[0], ua[1] + ub[1]]);
    const c = [p[0] + bis[0] * (r / Math.sin(half)), p[1] + bis[1] * (r / Math.sin(half))];
    const t1 = [p[0] + ua[0] * d, p[1] + ua[1] * d],
      t2 = [p[0] + ub[0] * d, p[1] + ub[1] * d];
    let s = Math.atan2(t1[1] - c[1], t1[0] - c[0]),
      e = Math.atan2(t2[1] - c[1], t2[0] - c[0]);
    while (e < s) e += 2 * Math.PI;
    if (e - s > Math.PI) e -= 2 * Math.PI;
    for (let k = 0; k <= 10; k++)
      pts.push([c[0] + r * Math.cos(s + ((e - s) * k) / 10), c[1] + r * Math.sin(s + ((e - s) * k) / 10)]);
  }
  return pts;
}
function norm([x, y]) {
  const l = Math.hypot(x, y);
  return [x / l, y / l];
}
/** Convex hull (monotone chain). */
function hull(p) {
  p = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [],
    up = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), q) <= 0) lo.pop();
    lo.push(q);
  }
  for (const q of p.reverse()) {
    while (up.length >= 2 && cross(up.at(-2), up.at(-1), q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const shadow = (pts) => hull(pts.concat(pts.map(([x, y]) => [x + L, y + L])));

// sole = hull of the ball and the heel (wide ball, narrow heel); toes get no shadow so the mark stays clean small
const sole = hull(circle(23.4, 32, 7.2).concat(circle(20.4, 46.5, 5.4)));
const toes = [circle(16.6, 19.9, 2.3), circle(21.6, 17.1, 2.8), circle(27.6, 18.4, 3.5)];
const play = roundTri(
  [
    [34, 21],
    [34, 47],
    [53, 34],
  ],
  3.2,
);
const shapes = { sole: pathOf(sole), toes: toes.map(pathOf).join(''), play: pathOf(play) };
const shadows = [sole, play].map((s) => pathOf(shadow(s))).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="InStep">
  <rect width="64" height="64" rx="15" fill="${TILE}"/>
  <path d="${shadows}" fill="${SHADOW}"/>
  <path d="${shapes.sole}${shapes.toes}" fill="${SOLE}"/>
  <path d="${shapes.play}" fill="${PLAY}"/>
</svg>
`;
writeFileSync(new URL('../../apps/companion/public/logo.svg', import.meta.url), svg);
console.log(
  JSON.stringify({ TILE, SHADOW, SOLE, PLAY, shadows, sole: shapes.sole + shapes.toes, play: shapes.play }),
);
