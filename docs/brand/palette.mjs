// Generates palette.json from OKLCH values (hue families frozen; tweak L/C only):  node docs/brand/palette.mjs > docs/brand/palette.json
import { toHex as t, cr, over } from './oklch.mjs';
const P = {
  canvas: t(0.185, 0.06, 278),
  surface: t(0.245, 0.065, 278),
  surface2: t(0.305, 0.07, 278),
  text: t(0.975, 0.01, 280),
  textMuted: t(0.8, 0.035, 278),
  primary: t(0.79, 0.13, 238),
  primaryInk: t(0.2, 0.06, 255),
  /** tertiary text (TV faint), neutral info chips, unused skeleton joints */
  textFaint: t(0.73, 0.04, 278),
  info: t(0.8, 0.08, 282),
  neutral: t(0.56, 0.035, 278),
};
const accents = {
  sky: P.primary,
  iris: t(0.74, 0.15, 292),
  lagoon: t(0.81, 0.11, 192),
  rose: t(0.74, 0.16, 358),
  sun: t(0.88, 0.15, 95),
  peach: t(0.84, 0.085, 50),
};
const status = { ok: t(0.8, 0.19, 150), near: t(0.83, 0.16, 72), far: t(0.71, 0.19, 25) };
const channels = {
  fall_prevention: accents.sky,
  sign_language: accents.iris,
  stroke_rehab: accents.lagoon,
  cpr: accents.rose,
  kids: accents.sun,
};
const skin = [
  t(0.9, 0.045, 60),
  t(0.82, 0.07, 55),
  t(0.72, 0.085, 52),
  t(0.6, 0.085, 48),
  t(0.48, 0.075, 45),
  t(0.38, 0.055, 40),
];
const illustration = {
  shadow: t(0.13, 0.05, 278),
  longShadow: 'rgba(5,6,26,0.45)',
  longShadowHex: '#05061A',
  longShadowOpacity: 0.45,
  highlight: 'rgba(255,255,255,0.22)',
  highlightHex: '#FFFFFF',
  highlightOpacity: 0.22,
  rimLight: t(0.88, 0.07, 238),
  skyTop: t(0.24, 0.08, 278),
  skyBottom: t(0.34, 0.09, 290),
  wall: t(0.3, 0.07, 280),
  wallLight: t(0.38, 0.075, 282),
  floor: t(0.27, 0.05, 260),
  floorLight: t(0.34, 0.055, 255),
  rug: t(0.45, 0.11, 300),
  furniture: t(0.42, 0.06, 40),
  furnitureLight: t(0.52, 0.065, 45),
  leaf: t(0.62, 0.09, 185),
  leafDark: t(0.48, 0.08, 190),
  hair: [t(0.25, 0.03, 50), t(0.42, 0.07, 50), t(0.85, 0.01, 270), t(0.62, 0.12, 40)],
  clothes: [
    accents.sky,
    accents.iris,
    accents.lagoon,
    accents.rose,
    accents.sun,
    t(0.62, 0.12, 265),
    t(0.95, 0.01, 280),
  ],
  pants: [t(0.33, 0.06, 265), t(0.42, 0.05, 240), t(0.28, 0.03, 280)],
};
const contrast = {};
for (const [k, v] of Object.entries({
  text: P.text,
  textMuted: P.textMuted,
  textFaint: P.textFaint,
  primary: P.primary,
  info: P.info,
  ...status,
  ...channels,
}))
  contrast[k] = { canvas: cr(v, P.canvas), surface: cr(v, P.surface), surface2: cr(v, P.surface2) };
contrast.primaryInk_on_primary = cr(P.primaryInk, P.primary);
contrast.primaryInk_on_ok = cr(P.primaryInk, status.ok);
/** Translucent UI tokens, composited over the canvas / surfaces they sit on. */
const ui = {
  tvGlass: [0.1, 0.16, 0.24].map((a) => `rgba(170,176,255,${a})`),
  companionLabel2: 'rgba(226,229,255,0.64)',
  companionLabel3: 'rgba(226,229,255,0.5)',
};
const glass = [0.1, 0.16, 0.24].map((a) => over([170, 176, 255, a], P.canvas));
contrast.tv_text_on_glass = glass.map((g) => cr(P.text, g));
contrast.tv_muted_on_glass = glass.map((g) => cr(P.textMuted, g));
contrast.tv_faint_on_glass = glass.map((g) => cr(P.textFaint, g));
contrast.companion_label2 = [P.canvas, P.surface, P.surface2].map((b) =>
  cr(over([226, 229, 255, 0.64], b), b),
);
contrast.companion_label3_nonText = [P.canvas, P.surface, P.surface2].map((b) =>
  cr(over([226, 229, 255, 0.5], b), b),
);
const out = {
  name: 'InStep — Blue Hour',
  version: 1,
  about:
    'Flat, outline-free illustration on a deep night-indigo canvas (layered rounded shapes, soft long shadows, saturated colour). Dark-first for living-room TVs. Status colours (ok/near/far) are reserved for feedback and never used as brand or decoration. Hue families are frozen; only small shade tweaks allowed.',
  ...P,
  accents,
  status,
  channels,
  skin,
  illustration,
  rules: [
    'No outlines/strokes on illustrated shapes; separate shapes by value (lighter in front, darker behind).',
    'Long shadows: 45 deg down-right, illustration.longShadow, no blur; contact shadows are soft ellipses in illustration.shadow at 40% opacity.',
    'One highlight per form (illustration.highlight) on the upper-left edge; corner radius generous (>= 12% of the shape).',
    'Never paint large areas in status.ok / status.near / status.far; never green plants next to the teaching figure (use illustration.leaf, a teal).',
    'Figures: skin from skin[], clothes from illustration.clothes; the teaching figure wears the lesson channel colour.',
    'Text over illustration: text colour on canvas/surface only (contrast table below), never on accents.',
  ],
  ui,
  contrast,
};
console.log(JSON.stringify(out, null, 2));
