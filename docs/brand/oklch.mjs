// OKLCH -> sRGB hex and WCAG 2 contrast ratio (used by palette.mjs).
export const toHex = (L, C, H) => {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const enc = (x) => {
    x = Math.min(1, Math.max(0, x));
    x = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return ('#' + rgb.map(enc).join('')).toUpperCase();
};

const lum = (hex) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
/** WCAG 2 contrast ratio, 2 decimals. */
export const cr = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
};

/** Alpha-composite rgba(r,g,b,a) over an opaque hex background; returns hex. */
export const over = ([r, g, b, a], bg) => {
  const c = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  const mix = [r, g, b].map((v, i) => Math.round(v * a + c[i] * (1 - a)));
  return ('#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('')).toUpperCase();
};
