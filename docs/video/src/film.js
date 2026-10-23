/* InStep demo film: every frame is a pure function of t (seconds). Timeline: timeline.json (timeline.py). */
'use strict';
const W = 1920,
  H = 1080,
  FPS = 30;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const C = {
  night: '#0B0B0F',
  cream: '#F2EEE6',
  ink: '#0D0E2C',
  text: '#F5F6FE',
  muted: '#B8BCD5',
  faint: '#A1A6C1',
  sky: '#5FC6FF',
  iris: '#AE97FF',
  lagoon: '#5BD7D3',
  rose: '#F87BAA',
  sun: '#F6D653',
  peach: '#F9BB99',
  surface: '#1A1C3F',
  surface2: '#272A52',
  ok: '#49DE78',
};
let TL = null,
  WEB = {};

// ---------- maths
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, b) => cl((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const out3 = (x) => 1 - Math.pow(1 - cl(x), 3);
const out5 = (x) => 1 - Math.pow(1 - cl(x), 5);
const inout = (x) => {
  x = cl(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const spring = (x) => {
  x = cl(x);
  const w = 7.5;
  return x >= 1 ? 1 : 1 - (1 + w * x) * Math.exp(-w * x);
};
const frac = (x) => x - Math.floor(x);
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
// blur-in / blur-out visibility: {a, blur, dy}
function vis(t, a, b = 1e9, din = 0.6, dout = 0.4) {
  const i = out3(P(t, a, a + din)),
    o = P(t, b, b + dout);
  return { a: i * (1 - o), blur: (1 - i) * 18 + o * 14, dy: (1 - i) * 28 - out3(o) * 18 };
}

// ---------- images (draw once, await anything missing, draw again)
const IM = {};
let PENDING = [];
function im(src) {
  let o = IM[src];
  if (!o) {
    o = IM[src] = { img: new Image(), ok: false };
    o.p = new Promise((res) => {
      o.img.onload = () => {
        o.ok = true;
        res();
      };
      o.img.onerror = () => {
        o.ok = true;
        o.bad = true;
        console.error('missing image ' + src);
        res();
      };
    });
    o.img.src = src;
  }
  if (!o.ok) PENDING.push(o.p);
  return o.ok && !o.bad ? o.img : null;
}
function clip(slot, lt, loop = false) {
  const c = TL.clips[slot];
  if (!c) return null;
  const n = Math.max(1, Math.floor(c.dur * FPS) - 1);
  let i = Math.floor(lt * FPS);
  i = loop ? ((i % n) + n) % n : cl(i, 0, n - 1);
  return frameImg(`../.cache/clips/${slot}/${String(i + 1).padStart(5, '0')}.jpg`);
}
const RECENT = [];
function frameImg(src) {
  // footage frames: keep only the last few decoded, so memory stays flat
  if (!IM[src]) {
    RECENT.push(src);
    while (RECENT.length > 10) {
      const k = RECENT.shift();
      if (IM[k] && IM[k].ok) {
        IM[k].img.src = '';
        delete IM[k];
      }
    }
  }
  return im(src);
}

// ---------- drawing helpers
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
function glow(c, x, y, r, col, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(col, a));
  g.addColorStop(0.5, hexA(col, a * 0.45));
  g.addColorStop(1, hexA(col, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}
const NOISE = (() => {
  const n = document.createElement('canvas');
  n.width = n.height = 256;
  const g = n.getContext('2d'),
    d = g.createImageData(256, 256);
  let s = 7;
  for (let i = 0; i < d.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = s % 256;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return n;
})();
function bg(c, t, mode) {
  if (mode === 'cream') {
    c.fillStyle = C.cream;
    c.fillRect(0, 0, W, H);
    glow(c, 560 + 90 * Math.sin(t / 9.7), 280, 1000, C.sun, 0.3);
    glow(c, 1480, 880 + 50 * Math.cos(t / 11.3), 900, C.peach, 0.22);
    glow(c, 1650, 160, 650, C.sky, 0.1);
  } else {
    c.fillStyle = C.night;
    c.fillRect(0, 0, W, H);
    glow(c, 960 + 160 * Math.sin(t / 10.3), 700, 1050, C.sky, 0.12);
    glow(c, 380, 170 + 60 * Math.cos(t / 12.1), 820, C.sun, 0.05);
  }
  c.save();
  c.globalAlpha = mode === 'cream' ? 0.05 : 0.035;
  c.globalCompositeOperation = 'overlay';
  c.fillStyle = c.createPattern(NOISE, 'repeat');
  c.fillRect(0, 0, W, H);
  c.restore();
}
function txt(c, s, x, y, o = {}) {
  const size = o.size || 48;
  c.save();
  c.font = `${o.w || 600} ${size}px Inter`;
  c.letterSpacing = (o.track != null ? o.track : -0.022 * size) + 'px';
  c.textAlign = o.align || 'center';
  c.textBaseline = o.base || 'alphabetic';
  c.fillStyle = o.color || C.text;
  c.globalAlpha *= o.alpha ?? 1;
  if ((o.blur || 0) > 0.3) c.filter = `blur(${o.blur.toFixed(1)}px)`;
  c.fillText(s, x, y);
  c.restore();
}
function tw(c, s, size, w = 600, track) {
  c.save();
  c.font = `${w} ${size}px Inter`;
  c.letterSpacing = (track != null ? track : -0.022 * size) + 'px';
  const m = c.measureText(s).width;
  c.restore();
  return m;
}
// camera: put world point (fx, fy) at screen centre, scaled by z
function cam(c, z, fx = W / 2, fy = H / 2) {
  c.translate(W / 2, H / 2);
  c.scale(z, z);
  c.translate(-fx, -fy);
}
function shadowed(c, blur, dy, a, fn) {
  c.save();
  c.shadowColor = `rgba(0,0,0,${a})`;
  c.shadowBlur = blur;
  c.shadowOffsetY = dy;
  fn();
  c.restore();
}
function pill(c, s, x, y, o = {}) {
  // label pill, x = left (or centre with o.center)
  const size = o.size || 22,
    padX = size * 0.75,
    h = size * 1.9,
    dot = o.dot ? size * 0.9 : 0;
  const w = tw(c, s, size, o.w || 500, 0) + padX * 2 + dot;
  const x0 = o.center ? x - w / 2 : x;
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  rr(c, x0, y - h / 2, w, h, h / 2);
  c.fillStyle = o.bg || 'rgba(255,255,255,0.08)';
  c.fill();
  c.strokeStyle = o.stroke || 'rgba(255,255,255,0.16)';
  c.lineWidth = 1.5;
  c.stroke();
  if (o.dot) {
    c.beginPath();
    c.arc(x0 + padX + size * 0.25, y, size * 0.25, 0, 7);
    c.fillStyle = o.dot;
    c.fill();
  }
  txt(c, s, x0 + padX + dot, y + size * 0.36, {
    size,
    w: o.w || 500,
    align: 'left',
    color: o.color || C.text,
    track: 0,
  });
  c.restore();
  return w;
}
function tv(c, cx, cy, sw, draw, o = {}) {
  const sh = (sw * 9) / 16,
    b = Math.max(8, sw * 0.011),
    x = cx - sw / 2,
    y = cy - sh / 2;
  if (o.stand) {
    c.save();
    c.fillStyle = '#121218';
    rr(c, cx - sw * 0.03, y + sh + b, sw * 0.06, sw * 0.05, 4);
    c.fill();
    rr(c, cx - sw * 0.16, y + sh + b + sw * 0.045, sw * 0.32, sw * 0.012, sw * 0.006);
    c.fill();
    c.restore();
  }
  shadowed(c, sw * 0.06, sw * 0.025, 0.55, () => {
    rr(c, x - b, y - b, sw + 2 * b, sh + 2 * b, b * 1.3);
    c.fillStyle = '#060608';
    c.fill();
  });
  c.save();
  rr(c, x - b, y - b, sw + 2 * b, sh + 2 * b, b * 1.3);
  c.strokeStyle = 'rgba(255,255,255,0.10)';
  c.lineWidth = 1.5;
  c.stroke();
  c.restore();
  c.save();
  rr(c, x, y, sw, sh, 2);
  c.clip();
  c.fillStyle = '#000';
  c.fillRect(x, y, sw, sh);
  draw(x, y, sw, sh);
  c.restore();
}
function phone(c, cx, cy, h, draw) {
  // generic phone: rounded slab, punch-hole camera, no brand marks
  const sw = (h * 824) / 1678,
    b = h * 0.022,
    x = cx - sw / 2,
    y = cy - h / 2;
  shadowed(c, h * 0.08, h * 0.03, 0.5, () => {
    rr(c, x - b, y - b, sw + 2 * b, h + 2 * b, h * 0.075);
    c.fillStyle = '#17181E';
    c.fill();
  });
  c.save();
  rr(c, x - b, y - b, sw + 2 * b, h + 2 * b, h * 0.075);
  c.strokeStyle = 'rgba(255,255,255,0.14)';
  c.lineWidth = 2;
  c.stroke();
  c.restore();
  c.save();
  rr(c, x, y, sw, h, h * 0.058);
  c.clip();
  c.fillStyle = '#0D0E2C';
  c.fillRect(x, y, sw, h);
  draw(x, y, sw, h);
  c.restore();
  c.beginPath();
  c.arc(cx, y + h * 0.018, h * 0.007, 0, 7);
  c.fillStyle = '#000';
  c.fill();
  return { x, y, w: sw, h };
}
function drawImg(c, img, x, y, w, h, a = 1) {
  if (!img) return;
  c.save();
  c.globalAlpha *= a;
  c.drawImage(img, x, y, w, h);
  c.restore();
}

// ---------- logo (apps/companion/public/logo.svg, viewBox 64)
const LOGO = {
  shadow: new Path2D(
    'M15 46.5L15.05 45.8L16.26 31.06L16.45 30.14L16.75 29.24L17.16 28.4L17.69 27.62L18.31 26.91L19.02 26.29L19.8 25.76L20.64 25.35L21.54 25.05L22.46 24.86L23.4 24.8L24.34 24.86L25.26 25.05L26.16 25.35L27 25.76L27.78 26.29L28.49 26.91L35.49 33.91L36.11 34.62L36.64 35.4L37.05 36.24L37.35 37.14L37.54 38.06L37.6 39L37.54 39.94L37.35 40.86L32.62 54.9L32.39 55.57L32.08 56.2L31.68 56.79L31.22 57.32L30.69 57.78L30.1 58.18L29.47 58.49L28.8 58.72L28.1 58.85L27.4 58.9L26.7 58.85L26 58.72L25.33 58.49L24.7 58.18L24.11 57.78L23.58 57.32L16.58 50.32L16.12 49.79L15.72 49.2L15.41 48.57L15.18 47.9L15.05 47.2ZM34 27.07L34.08 26.38L34.3 25.72L34.65 25.13L35.13 24.62L35.71 24.24L36.35 23.98L37.04 23.87L37.73 23.91L38.4 24.1L39.01 24.43L49.14 31.36L49.62 31.76L56.62 38.76L57.01 39.24L57.29 39.79L57.47 40.38L57.53 41L57.47 41.62L57.29 42.21L57.01 42.76L56.62 43.24L56.14 43.64L46.01 50.57L45.4 50.9L44.73 51.09L44.04 51.13L43.35 51.02L42.71 50.76L42.13 50.38L35.13 43.38L34.65 42.87L34.3 42.28L34.08 41.62L34 40.93Z',
  ),
  sole: new Path2D(
    'M15 46.5L15.05 45.8L16.26 31.06L16.45 30.14L16.75 29.24L17.16 28.4L17.69 27.62L18.31 26.91L19.02 26.29L19.8 25.76L20.64 25.35L21.54 25.05L22.46 24.86L23.4 24.8L24.34 24.86L25.26 25.05L26.16 25.35L27 25.76L27.78 26.29L28.49 26.91L29.11 27.62L29.64 28.4L30.05 29.24L30.35 30.14L30.54 31.06L30.6 32L30.54 32.94L30.35 33.86L25.62 47.9L25.39 48.57L25.08 49.2L24.68 49.79L24.22 50.32L23.69 50.78L23.1 51.18L22.47 51.49L21.8 51.72L21.1 51.85L20.4 51.9L19.7 51.85L19 51.72L18.33 51.49L17.7 51.18L17.11 50.78L16.58 50.32L16.12 49.79L15.72 49.2L15.41 48.57L15.18 47.9L15.05 47.2Z',
  ),
  toes: [
    [16.6, 19.9, 2.3],
    [21.6, 17.1, 2.8],
    [27.6, 18.4, 3.5],
  ],
  play: new Path2D(
    'M39.01 24.43L38.4 24.1L37.73 23.91L37.04 23.87L36.35 23.98L35.71 24.24L35.13 24.62L34.65 25.13L34.3 25.72L34.08 26.38L34 27.07L34 40.93L34.08 41.62L34.3 42.28L34.65 42.87L35.13 43.38L35.71 43.76L36.35 44.02L37.04 44.13L37.73 44.09L38.4 43.9L39.01 43.57L49.14 36.64L49.62 36.24L50.01 35.76L50.29 35.21L50.47 34.62L50.53 34L50.47 33.38L50.29 32.79L50.01 32.24L49.62 31.76L49.14 31.36Z',
  ),
};
// p: 0..1 build progress (tile, sole, toes, play); size in px; (x, y) top-left
function logo(c, x, y, size, p = 1, tile = true) {
  const k = size / 64;
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  if (tile) {
    const s = spring(P(p, 0, 0.3));
    c.save();
    c.translate(32, 32);
    c.scale(0.6 + 0.4 * s, 0.6 + 0.4 * s);
    c.translate(-32, -32);
    c.globalAlpha = P(p, 0, 0.12);
    rr(c, 0, 0, 64, 64, 15);
    c.fillStyle = C.surface2;
    c.fill();
    c.restore();
    c.save();
    c.globalAlpha = P(p, 0.55, 0.8);
    c.fillStyle = C.surface;
    c.fill(LOGO.shadow);
    c.restore();
  }
  const sole = out3(P(p, 0.2, 0.5));
  c.save();
  c.beginPath();
  c.rect(0, 52 - 30 * sole, 64, 40);
  c.clip();
  c.fillStyle = C.sky;
  c.fill(LOGO.sole);
  c.restore();
  LOGO.toes.forEach(([tx, ty, r], i) => {
    const s = spring(P(p, 0.42 + i * 0.07, 0.62 + i * 0.07));
    if (s > 0) {
      c.beginPath();
      c.arc(tx, ty, r * s, 0, 7);
      c.fillStyle = C.sky;
      c.fill();
    }
  });
  const pl = out3(P(p, 0.6, 0.9));
  c.save();
  c.globalAlpha = pl;
  c.translate(-10 * (1 - pl), 0);
  c.fillStyle = C.sun;
  c.fill(LOGO.play);
  c.restore();
  c.restore();
}

// ---------- captions (from timeline) and labels
function captions(c, t) {
  const cap = TL.captions.find((k) => k.burn && t >= k.a - 0.12 && t < k.b + 0.12);
  if (!cap) return;
  if (cap.tv) return tvCaption(c, t, cap);
  const a = Math.min(P(t, cap.a - 0.12, cap.a + 0.05), 1 - P(t, cap.b - 0.05, cap.b + 0.12));
  const size = 38,
    maxW = 1500;
  // wrap to at most two lines
  const words = cap.text.split(' ');
  let lines = [cap.text];
  if (tw(c, cap.text, size, 600, 0) > maxW) {
    let best = 1,
      bestD = 1e9;
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(
        tw(c, words.slice(0, i).join(' '), size, 600, 0) - tw(c, words.slice(i).join(' '), size, 600, 0),
      );
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  const lh = size * 1.3,
    w = Math.max(...lines.map((l) => tw(c, l, size, 600, 0))) + 56,
    h = lines.length * lh + 26;
  const y0 = 1040 - h;
  c.save();
  c.globalAlpha = a;
  rr(c, W / 2 - w / 2, y0, w, h, 18);
  c.fillStyle = 'rgba(9,9,13,0.74)';
  c.fill();
  lines.forEach((l, i) =>
    txt(c, l, W / 2, y0 + 13 + lh * i + size * 0.98, { size, w: 600, track: 0, color: '#FFFFFF' }),
  );
  c.restore();
}

function tvCaption(c, t, cap) {
  // the TV's own narration: smaller, indigo, tagged "TV"
  const a = Math.min(P(t, cap.a - 0.12, cap.a + 0.05), 1 - P(t, cap.b - 0.05, cap.b + 0.12));
  const size = 32,
    tag = 'TV',
    tagW = tw(c, tag, 20, 700, 1.5) + 26;
  const w = tw(c, cap.text, size, 500, 0) + tagW + 64,
    h = 70,
    y0 = 1036 - h;
  c.save();
  c.globalAlpha = a;
  rr(c, W / 2 - w / 2, y0, w, h, 35);
  c.fillStyle = 'rgba(16,18,46,0.88)';
  c.fill();
  c.strokeStyle = hexA(C.sky, 0.45);
  c.lineWidth = 1.5;
  c.stroke();
  const x0 = W / 2 - w / 2 + 18;
  rr(c, x0, y0 + 19, tagW, 32, 16);
  c.fillStyle = hexA(C.sky, 0.22);
  c.fill();
  txt(c, tag, x0 + tagW / 2, y0 + 42, { size: 20, w: 700, color: C.sky, track: 1.5 });
  txt(c, cap.text, x0 + tagW + 16, y0 + 46, { size, w: 500, align: 'left', track: 0, color: '#EEF0FF' });
  c.restore();
}

// ---------- shots. Each: (ctx, local t, v1 film time)
const S = {};

// opening: the real boot recording (boot.mp4), cut to its beats; TL.open = [[from, to, speed], ...] -> clip slots s1<k>
function openingFrame(l) {
  let k = TL.open.findIndex(([, b]) => l < b);
  if (k < 0) k = TL.open.length - 1;
  const [a, , r] = TL.open[k];
  return { img: clip('s1' + k, Math.max(0, l - a) * r), rate: r, k };
}
S.s1 = (c, l) => {
  // TV wakes, remote presses Select, real Vega Virtual Device footage
  bg(c, l, 'dark');
  const z = lerp(0.92, 1.04, inout(P(l, 0, 13.5)));
  c.save();
  cam(c, z, 960, 520);
  c.save();
  const g = c.createLinearGradient(0, 860, 0, 940);
  g.addColorStop(0, '#1A1A21');
  g.addColorStop(1, '#101015');
  rr(c, 300, 870, 1320, 64, 14);
  c.fillStyle = g;
  c.fill();
  c.restore();
  const on = out3(P(l, 0.85, 1.3));
  if (on > 0) glow(c, 960, 470, 900, C.sky, 0.1 * on);
  tv(c, 960, 470, 1180, (x, y, w, h) => {
    const gl = c.createLinearGradient(x, y, x + w, y + h);
    gl.addColorStop(0, '#15161C');
    gl.addColorStop(0.45, '#0A0A0E');
    gl.addColorStop(1, '#060608');
    c.fillStyle = gl;
    c.fillRect(x, y, w, h);
    if (on <= 0) return;
    const f = openingFrame(l);
    let prev = null,
      mix = 1;
    for (const [a] of TL.open.slice(1))
      if (l >= a && l < a + 0.3) {
        prev = openingFrame(a - 0.04).img;
        mix = P(l, a, a + 0.3);
      }
    c.save();
    c.translate(x + w / 2, y + h / 2);
    const s = 1.03 - 0.03 * on;
    c.scale(s, s);
    c.translate(-(x + w / 2), -(y + h / 2));
    if (prev) drawImg(c, prev, x, y, w, h, on);
    drawImg(c, f.img, x, y, w, h, on * mix);
    c.restore();
    c.fillStyle = `rgba(255,255,255,${0.5 * (1 - on) * (on > 0)})`;
    c.fillRect(x, y, w, h);
  });
  c.restore();
  const ry = lerp(1250, 790, spring(P(l, 0.0, 0.8)));
  const PR = [0.7, 6.4, 9.55, 11.45];
  const press = Math.max(0, ...PR.map((p) => 1 - Math.abs(l - p) / 0.25));
  remote(
    c,
    1620,
    ry + press * 8,
    press,
    PR.map((p) => P(l, p - 0.05, p + 0.65)),
  );
  const v = vis(l, 1.6);
  txt(c, 'Fire TV  ·  Vega OS', 960, 1005 + v.dy, {
    size: 34,
    w: 600,
    color: C.muted,
    alpha: v.a,
    blur: v.blur,
    track: 0.5,
  });
  const rate = openingFrame(l).rate;
  pill(
    c,
    rate > 1.3
      ? `Recorded on the Vega Virtual Device  ·  ${rate.toFixed(0)}× speed`
      : 'Recorded on the Vega Virtual Device',
    64,
    64,
    { size: 22, alpha: vis(l, 1.2).a, dot: C.sky },
  );
  c.fillStyle = `rgba(0,0,0,${1 - out3(P(l, 0, 0.6))})`;
  c.fillRect(0, 0, W, H);
};
function remote(c, cx, cy, press, ripples) {
  c.save();
  c.translate(cx, cy);
  c.rotate(-0.16);
  shadowed(c, 50, 24, 0.55, () => {
    rr(c, -78, -60, 156, 560, 78);
    c.fillStyle = '#1C1D24';
    c.fill();
  });
  const g = c.createLinearGradient(-78, 0, 78, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(0.4, 'rgba(255,255,255,0)');
  rr(c, -78, -60, 156, 560, 78);
  c.fillStyle = g;
  c.fill();
  c.beginPath();
  c.arc(0, -18, 6, 0, 7);
  c.fillStyle = '#3A3C46';
  c.fill();
  c.beginPath();
  c.arc(0, 80, 56, 0, 7);
  c.fillStyle = '#25262E';
  c.fill();
  c.beginPath();
  c.arc(0, 80, 28, 0, 7);
  c.fillStyle = press > 0 ? hexA(C.sky, 0.35 + 0.65 * press) : '#30323B';
  c.fill();
  for (const r of ripples)
    if (r > 0 && r < 1) {
      c.beginPath();
      c.arc(0, 80, 28 + 70 * out3(r), 0, 7);
      c.strokeStyle = hexA(C.sky, 0.6 * (1 - r));
      c.lineWidth = 3;
      c.stroke();
    }
  for (const [bx, by] of [
    [-34, 178],
    [34, 178],
    [-34, 236],
    [34, 236],
    [0, 300],
  ]) {
    c.beginPath();
    c.arc(bx, by, 17, 0, 7);
    c.fillStyle = '#2A2B33';
    c.fill();
  }
  c.restore();
}

S.s2 = (c, l, t) => {
  // kinetic type
  bg(c, t, 'cream');
  const ph = [
    ['Every how-to video', 6.7, 8.1],
    ['plays at the same speed.', 8.15, 9.8],
    ['whether you keep up,', 9.85, 11.3],
    ['or not.', 11.4, 1e9],
  ];
  const push = inout(P(t, 12.0, 13.6));
  c.save();
  cam(c, 1 + 0.22 * push, 960, 540);
  for (const [s, a, b] of ph) {
    const v = vis(t, a, b, 0.55, 0.35);
    if (v.a > 0.001)
      txt(c, s, 960, 575 + v.dy, { size: 116, w: 650, color: C.ink, alpha: v.a, blur: v.blur });
  }
  c.restore();
  // a playhead that never waits
  const bv = vis(t, 8.2, 12.1, 0.5, 0.5);
  if (bv.a > 0) {
    const x0 = 660,
      w = 600,
      y = 700,
      p = lerp(0.18, 0.92, P(t, 8.2, 13.4));
    c.save();
    c.globalAlpha = bv.a;
    rr(c, x0, y - 4, w, 8, 4);
    c.fillStyle = hexA(C.ink, 0.14);
    c.fill();
    rr(c, x0, y - 4, w * p, 8, 4);
    c.fillStyle = C.ink;
    c.fill();
    c.beginPath();
    c.arc(x0 + w * p, y, 13, 0, 7);
    c.fillStyle = C.ink;
    c.fill();
    c.beginPath();
    c.moveTo(x0 - 52, y - 15);
    c.lineTo(x0 - 52, y + 15);
    c.lineTo(x0 - 26, y);
    c.closePath();
    c.fill();
    c.restore();
  }
};

// web cards with a highlighter sweep. id: S1/S3/S5/S6; a = enter time; x = exit start; from: 'up' | 'right'
const SRC = {
  S1: [
    'World Health Organization · Falls fact sheet',
    'who.int/news-room/fact-sheets/detail/falls',
    'who.int',
  ],
  S3: [
    'Medical Economics · Ohio State Wexner Medical Center survey',
    'medicaleconomics.com/view/patients-aren-t-doing-their-physical-therapy-homework',
    'medicaleconomics.com',
  ],
  S6: [
    'American Heart Association · CPR Facts & Stats',
    'cpr.heart.org/en/resources/cpr-facts-and-stats',
    'cpr.heart.org',
  ],
  S5: [
    'Wikipedia · Language acquisition by deaf children (Mitchell & Karchmer, 2004)',
    'en.wikipedia.org/wiki/Language_acquisition_by_deaf_children',
    'en.wikipedia.org',
  ],
};
function webCard(c, t, id, a, x = 1e9, from = 'up', pull = 1e9) {
  const enter = out5(P(t, a, a + 0.85)),
    ex = inout(P(t, x, x + 0.7));
  if (enter <= 0 || ex >= 1) return;
  const w = 1240,
    k = w / 1440,
    bar = 44,
    ih = 900 * k,
    cx = 960,
    cy = 560;
  const x0 = cx - w / 2,
    y0 = cy - (ih + bar) / 2;
  const rects = (WEB[id] && WEB[id].hit && WEB[id].hit.rects) || [];
  let bx0 = 1e9,
    by0 = 1e9,
    bx1 = -1e9,
    by1 = -1e9;
  for (const r of rects) {
    bx0 = Math.min(bx0, r.x);
    by0 = Math.min(by0, r.y);
    bx1 = Math.max(bx1, r.x + r.w);
    by1 = Math.max(by1, r.y + r.h);
  }
  const fx = x0 + ((bx0 + bx1) / 2) * k,
    fy = y0 + bar + ((by0 + by1) / 2) * k;
  const Z = rects.length ? cl(1250 / ((bx1 - bx0) * k), 1, 2.1) : 1;
  const pu = inout(P(t, a + 1.0, a + 2.0)) * (1 - inout(P(t, pull, pull + 0.9)));
  c.save();
  const dx = from === 'right' ? (1 - enter) * 900 : 0,
    dy = from === 'up' ? (1 - enter) * 160 : 0;
  c.translate(dx - ex * 1000, dy);
  c.globalAlpha = enter * (1 - ex);
  if (enter < 1 || ex > 0) c.filter = `blur(${((1 - enter) * 14 + ex * 14).toFixed(1)}px)`;
  cam(
    c,
    lerp(1, Z, pu) * lerp(0.94, 1, enter) * lerp(1, 0.88, inout(P(t, pull, pull + 0.9))),
    lerp(cx, fx, pu),
    lerp(cy, fy, pu),
  );
  shadowed(c, 60, 26, 0.18, () => {
    rr(c, x0, y0, w, ih + bar, 18);
    c.fillStyle = '#fff';
    c.fill();
  });
  c.save();
  rr(c, x0, y0, w, ih + bar, 18);
  c.clip();
  c.fillStyle = '#ECEAE6';
  c.fillRect(x0, y0, w, bar);
  [0, 1, 2].forEach((i) => {
    c.beginPath();
    c.arc(x0 + 26 + i * 22, y0 + bar / 2, 6.5, 0, 7);
    c.fillStyle = '#CFCBC4';
    c.fill();
  });
  rr(c, cx - 230, y0 + 9, 460, bar - 18, 13);
  c.fillStyle = '#fff';
  c.fill();
  txt(c, SRC[id][2], cx, y0 + bar / 2 + 7, { size: 19, w: 500, color: '#55565E', track: 0 });
  drawImg(c, im(`../assets/web/${id}.png`), x0, y0 + bar, w, ih);
  // highlighter
  const hp = P(t, a + 2.05, a + 2.95);
  const total = rects.reduce((s, r) => s + r.w, 0);
  let done = 0;
  c.globalCompositeOperation = 'multiply';
  for (const r of rects) {
    const fw = cl(hp * total - done, 0, r.w);
    done += r.w;
    if (fw <= 0) continue;
    rr(c, x0 + (r.x - 4) * k, y0 + bar + (r.y + 1) * k, (fw + 8) * k, (r.h + 2) * k, 3 * k);
    c.fillStyle = hexA(C.sun, 0.75);
    c.fill();
  }
  c.restore();
  c.restore();
}
function sourcePill(c, t, id, a, b) {
  const v = vis(t, a, b, 0.6, 0.4);
  if (v.a <= 0) return;
  c.save();
  c.globalAlpha = v.a;
  c.translate(0, v.dy * 0.5);
  const [title, url] = SRC[id];
  const w = Math.max(tw(c, title, 24, 600, 0), tw(c, url, 19, 500, 0)) + 60;
  shadowed(c, 30, 10, 0.12, () => {
    rr(c, W / 2 - w / 2, 36, w, 84, 20);
    c.fillStyle = '#fff';
    c.fill();
  });
  txt(c, title, W / 2, 72, { size: 24, w: 600, color: C.ink, track: 0 });
  txt(c, url, W / 2, 102, { size: 19, w: 500, color: hexA(C.ink, 0.6), track: 0 });
  c.restore();
}
S.s3 = (c, l, t) => {
  bg(c, t, 'cream');
  webCard(c, t, 'S1', 13.45, 19.95, 'up');
  webCard(c, t, 'S3', 20.35, 27.6, 'right');
  webCard(c, t, 'S6', 27.85, 1e9, 'right');
  sourcePill(c, t, 'S1', 13.7, 19.9);
  sourcePill(c, t, 'S3', 20.6, 27.5);
  sourcePill(c, t, 'S6', 28.1, 1e9);
};
S.s4 = (c, l, t) => {
  bg(c, t, 'cream');
  webCard(c, t, 'S5', 35.7, 1e9, 'up', 40.7);
  sourcePill(c, t, 'S5', 35.9, 40.7);
  const veil = inout(P(t, 40.8, 41.6));
  if (veil > 0) {
    c.fillStyle = hexA(C.cream, 0.86 * veil);
    c.fillRect(0, 0, W, H);
  }
  const v = vis(t, 41.05);
  if (v.a > 0) {
    txt(c, 'And a video can’t see', 960, 510 + v.dy, {
      size: 104,
      w: 650,
      color: C.ink,
      alpha: v.a,
      blur: v.blur,
    });
    const v2 = vis(t, 41.55);
    txt(c, 'whether your hands are right.', 960, 640 + v2.dy, {
      size: 104,
      w: 650,
      color: C.ink,
      alpha: v2.a,
      blur: v2.blur,
    });
  }
};

S.s5 = (c, l, t) => {
  // logo lockup
  bg(c, t, 'dark');
  const z = lerp(1, 1.05, inout(P(t, 44.2, 52.4)));
  c.save();
  cam(c, z, 960, 520);
  const mark = 190,
    word = 'InStep',
    ws = 168,
    wW = tw(c, word, ws, 700);
  const gap = 44,
    total = mark + gap + wW,
    gx = 960 - total / 2;
  const slide = inout(P(t, 45.9, 46.7));
  const mx = lerp(960 - mark / 2, gx, slide),
    my = 330;
  glow(c, mx + mark / 2, my + mark / 2, 380, C.sky, 0.1 * P(t, 44.6, 45.6));
  logo(c, mx, my, mark, P(t, 44.5, 46.1));
  // wordmark letters blur in one by one
  let x = gx + mark + gap;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i],
      cw = tw(c, ch, ws, 700);
    const v = vis(t, 46.2 + i * 0.07, 1e9, 0.5);
    if (v.a > 0)
      txt(c, ch, x, my + mark * 0.5 + ws * 0.36 + v.dy * 0.6, {
        size: ws,
        w: 700,
        align: 'left',
        alpha: v.a,
        blur: v.blur * 0.7,
        track: -0.035 * ws,
      });
    x += cw;
  }
  const tg = vis(t, 47.45);
  txt(c, 'The video that waits for you.', 960, 660 + tg.dy, {
    size: 54,
    w: 500,
    color: C.muted,
    alpha: tg.a,
    blur: tg.blur,
  });
  c.restore();
};

// phone + TV, body points flow, measured "video sent" callout
S.s6 = (c, l, t) => {
  bg(c, t, 'dark');
  const push = inout(P(t, 59.0, 60.2));
  c.save();
  cam(c, lerp(1, 1.28, push), lerp(960, 700, push), lerp(540, 560, push));
  const pin = spring(P(t, 52.1, 53.2)),
    tin = out5(P(t, 52.4, 53.4));
  // stand behind the phone
  const px = 560,
    py = 600 + (1 - pin) * 500;
  c.save();
  c.fillStyle = '#16171C';
  c.beginPath();
  c.moveTo(px - 60, py + 330);
  c.lineTo(px + 60, py + 330);
  c.lineTo(px + 150, py + 430);
  c.lineTo(px - 150, py + 430);
  c.closePath();
  c.fill();
  c.restore();
  const ph = phone(c, px, py, 680, (x, y, w, h) =>
    drawImg(c, im('../../screenshots/companion-join.png'), x, y, w, h),
  );
  // TV
  c.save();
  c.globalAlpha = tin * (1 - 0.6 * push);
  c.translate((1 - tin) * 200, 0);
  tv(c, 1300, 520, 880, (x, y, w, h) => drawImg(c, clip('heel', 12 + (t - 52)), x, y, w, h), { stand: true });
  c.restore();
  // body points travel phone -> TV along an arc
  const fl = P(t, 53.6, 54.4) * (1 - P(t, 66.6, 67.4));
  if (fl > 0) {
    const p0 = [ph.x + ph.w + 30, 470],
      p3 = [858, 470],
      c1 = [760, 300],
      c2 = [800, 300];
    for (let i = 0; i < 26; i++) {
      const u = frac(i / 26 + t * 0.32);
      const m = 1 - u,
        X = m * m * m * p0[0] + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u * u * u * p3[0];
      const Y = m * m * m * p0[1] + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u * u * u * p3[1];
      c.beginPath();
      c.arc(X, Y, 6.5, 0, 7);
      c.fillStyle = hexA(C.sky, fl * Math.sin(Math.PI * u) * 0.95);
      c.fill();
    }
    txt(c, 'body points only', 790, 262, { size: 24, w: 600, color: C.sky, alpha: fl * (1 - push) });
  }
  c.restore();
  const hv = vis(t, 52.5, 58.8);
  txt(c, 'The camera is your phone or laptop.', 960, 120 + hv.dy, {
    size: 58,
    w: 650,
    alpha: hv.a,
    blur: hv.blur,
  });
  const cv1 = vis(t, 59.7, 66.9);
  if (cv1.a > 0)
    pill(c, 'Pose tracking runs in the phone’s browser', 60, 72, { size: 24, alpha: cv1.a, dot: C.sky });
  // measured callout: only the VIDEO SENT box of the real companion screen
  const ca = out5(P(t, 61.7, 62.6)),
    cb = P(t, 67.0, 67.6);
  if (ca > 0) {
    c.save();
    c.globalAlpha = ca * (1 - cb);
    c.translate((1 - ca) * 260, 0);
    if (ca < 1) c.filter = `blur(${((1 - ca) * 10).toFixed(1)}px)`;
    const sx = 18,
      sy = 832,
      sw = 396,
      sh = 222,
      cw = 720,
      ch = (cw * sh) / sw,
      cx0 = 1120,
      cy0 = 520 - ch / 2;
    shadowed(c, 60, 24, 0.5, () => {
      rr(c, cx0, cy0, cw, ch, 28);
      c.fillStyle = '#0D0E2C';
      c.fill();
    });
    c.save();
    rr(c, cx0, cy0, cw, ch, 28);
    c.clip();
    const pimg = im('../../screenshots/companion-privacy.png');
    if (pimg) c.drawImage(pimg, sx, sy, sw, sh, cx0, cy0, cw, ch);
    c.restore();
    rr(c, cx0, cy0, cw, ch, 28);
    c.strokeStyle = hexA(C.sky, 0.25 + 0.5 * P(t, 64.6, 65.2));
    c.lineWidth = 3;
    c.stroke();
    txt(c, 'Measured on the phone, live', cx0 + cw / 2, cy0 + ch + 60, { size: 28, w: 500, color: C.muted });
    c.restore();
  }
};

// big TV with real footage
function tvShot(c, t, slot, lt, keys, o = {}) {
  bg(c, t, 'dark');
  const k = camKeys(keys, t);
  c.save();
  cam(c, k.z, k.x, k.y);
  tv(c, 960, 500, 1560, (x, y, w, h) => {
    if (o.draw) o.draw(x, y, w, h);
    else drawImg(c, clip(slot, lt), x, y, w, h);
  });
  c.restore();
}
function camKeys(keys, t) {
  // keys: [[t, z, x, y], ...] eased between consecutive keys (0.9 s moves end at next t)
  let z = keys[0][1],
    x = keys[0][2],
    y = keys[0][3];
  for (let i = 1; i < keys.length; i++) {
    const [kt, kz, kx, ky, d = 0.9] = keys[i];
    const p = inout(P(t, kt - d, kt));
    z = lerp(z, kz, p);
    x = lerp(x, kx, p);
    y = lerp(y, ky, p);
  }
  return { z, x, y };
}
// ---------- v2 shots: footage reels (timeline REELS -> clip slots <shot><k>)
function reel(sid, l) {
  // -> { k, lt, slot, full, a } for local time l, plus the previous segment for a short dissolve
  let t0 = 0;
  for (let k = 0; TL.clips[sid + k]; k++) {
    const c0 = TL.clips[sid + k];
    if (l < t0 + c0.dur || !TL.clips[sid + (k + 1)])
      return { k, lt: l - t0, slot: sid + k, full: c0.full, a: t0 };
    t0 += c0.dur;
  }
  return null;
}
function reelDraw(c, sid, l, x, y, w, h, X = 0.3) {
  const r = reel(sid, l);
  if (!r) return;
  if (r.k > 0 && r.lt < X && !TL.clips[sid + (r.k - 1)].full) {
    const pc = TL.clips[sid + (r.k - 1)];
    drawImg(c, clip(sid + (r.k - 1), pc.dur - 0.05), x, y, w, h);
    drawImg(c, clip(r.slot, r.lt), x, y, w, h, out3(r.lt / X));
  } else drawImg(c, clip(r.slot, r.lt), x, y, w, h);
}
function tvReel(c, sid, l, keys) {
  tvShot(c, l, null, l, keys, { draw: (x, y, w, h) => reelDraw(c, sid, l, x, y, w, h) });
}
function tags(c, l, list) {
  // top-left label pills: [text, dot, from, to]
  let y = 64;
  for (const [s, dot, a = 0.3, b = 1e9] of list) {
    const v = vis(l, a, b, 0.5, 0.35);
    if (v.a > 0) {
      pill(c, s, 60, y, { size: 22, alpha: v.a, dot });
      y += 52;
    }
  }
}
function note(c, l, s, a, b, col = C.sun) {
  // centred top pill for an honest caveat
  const v = vis(l, a, b, 0.5, 0.35);
  if (v.a > 0)
    pill(c, s, W / 2, 64 + v.dy * 0.4, {
      size: 26,
      w: 600,
      center: true,
      alpha: v.a,
      dot: col,
      bg: 'rgba(13,14,44,0.86)',
      stroke: hexA(col, 0.45),
    });
}

S.heel = (c, l) => {
  // Fall Prevention on the TV: gate pause, the TV's "Up, and down", rep count + tip, summary
  tvReel(c, 'heel', l, [
    [0, 1, 960, 520],
    [4, 1.07, 960, 520, 3.5],
    [12.3, 1.42, 760, 380],
    [18.3, 1.42, 760, 380],
    [19.4, 1.0, 960, 520],
    [21.6, 1.32, 930, 660, 1.4],
    [30.3, 1.32, 930, 660],
    [31.3, 1.0, 960, 520],
  ]);
  tags(c, l, [
    ['Recorded on the Vega Virtual Device', C.sky, 0.4],
    ['Simulated learner', C.peach, 0.7],
  ]);
  note(c, l, 'Tips are templated  ·  the AWS Bedrock coach is built, switched off', 24.6, 30.2);
  note(c, l, 'End-of-lesson summary, on the TV', 31.0, 34.6, C.ok);
};
S.safe = (c, l) => {
  // safety check gate, then the camera drops and the lesson stops
  tvReel(c, 'safe', l, [
    [0, 1.12, 960, 560],
    [1.6, 1.55, 860, 760, 1.4],
    [4.5, 1.55, 860, 760],
    [5.3, 1.0, 960, 520],
  ]);
  tags(c, l, [
    ['Recorded on the Vega Virtual Device', C.sky, 0.2],
    ['Simulated learner', C.peach, 0.2],
  ]);
  note(c, l, 'Safety gates use fixed values — never loosened', 0.6, 4.3, C.ok);
  note(c, l, 'No body points for 2 s → the lesson pauses', 6.4, 10.6, C.rose);
};
S.asl = (c, l) => {
  // launcher row -> Letter A (the TV speaks) -> Letter B with the hand overlay
  tvReel(c, 'asl', l, [
    [0, 1.0, 960, 520],
    [3.0, 1.0, 960, 520],
    [4.4, 1.32, 760, 340, 1.2],
    [9.0, 1.32, 760, 340],
    [9.8, 1.0, 960, 520],
    [11.6, 1.22, 1010, 420, 1.4],
  ]);
  tags(c, l, [
    ['Recorded on the Vega Virtual Device', C.sky, 0.3],
    ['Simulated learner', C.peach, 3.2],
  ]);
  note(c, l, 'Illustrated hands  ·  not yet reviewed by Deaf signers', 9.6, 18.2, C.iris);
};
S.kids = (c, l) => {
  // Kids' Forest Walk: lesson page -> the TV waits for the tree -> full-frame lesson video
  const r = reel('kids', l);
  if (!r.full || r.lt < 0.45) {
    tvReel(c, 'kids', l, [
      [0, 1.0, 960, 520],
      [3.2, 1.0, 960, 520],
      [4.6, 1.3, 760, 370, 1.2],
      [9.4, 1.3, 760, 370],
      [10.6, 1.05, 960, 520, 1.0],
      [13.6, 1.12, 760, 400, 3.0],
    ]);
    tags(c, l, [
      ['Recorded on the Vega Virtual Device', C.sky, 0.3],
      ['Simulated learner', C.peach, 3.4, 13.4],
    ]);
  }
  if (r.full) {
    // the lesson video itself, full frame
    const e = out3(r.lt / 0.45);
    c.save();
    c.globalAlpha = e;
    const z = lerp(1.0, 1.045, P(r.lt, 0, 6.3));
    c.save();
    cam(c, z * lerp(1.12, 1, e), 960, 560);
    drawImg(c, clip(r.slot, r.lt), 0, 0, W, H);
    c.restore();
    if (e < 1) {
      c.filter = `blur(${((1 - e) * 10).toFixed(1)}px)`;
    }
    c.restore();
    const lab = 'The animated lesson video  ·  what the TV plays',
      lw = tw(c, lab, 22, 500, 0) + 22 * 1.5 + 22 * 0.9;
    pill(c, lab, W - 60 - lw, 64, {
      size: 22,
      alpha: vis(r.lt, 0.35).a,
      dot: C.sun,
      bg: 'rgba(13,14,44,0.7)',
    });
  }
};

// fan of the seven real lesson posters, then rehab + CPR lesson videos, then Together mode on the TV
const POSTERS = [
  'fall-heel-raise-v1',
  'fall-single-leg-stand-v1',
  'asl-fingerspell-abc-v1',
  'asl-i-love-you-v1',
  'rehab-hand-open-close-v1',
  'cpr-rhythm-v1',
  'kids-forest-walk-v1',
];
function card(c, img, cx, cy, w, rot, a, label, col) {
  const h = (w * 9) / 16;
  c.save();
  c.globalAlpha *= a;
  c.translate(cx, cy);
  c.rotate(rot);
  shadowed(c, 40, 18, 0.5, () => {
    rr(c, -w / 2, -h / 2, w, h, 16);
    c.fillStyle = '#000';
    c.fill();
  });
  c.save();
  rr(c, -w / 2, -h / 2, w, h, 16);
  c.clip();
  drawImg(c, img, -w / 2, -h / 2, w, h);
  c.restore();
  rr(c, -w / 2, -h / 2, w, h, 16);
  c.strokeStyle = 'rgba(255,255,255,0.14)';
  c.lineWidth = 1.5;
  c.stroke();
  if (label) {
    c.beginPath();
    c.arc(-w / 2 + 8, h / 2 + 40, 7, 0, 7);
    c.fillStyle = col;
    c.fill();
    txt(c, label, -w / 2 + 26, h / 2 + 49, { size: 30, w: 600, align: 'left', track: 0 });
  }
  c.restore();
}
S.more = (c, l) => {
  bg(c, l, 'dark');
  // 1) fan
  const fanOut = inout(P(l, 2.0, 2.8));
  if (fanOut < 1) {
    const spread = out5(P(l, 0.15, 1.3));
    c.save();
    c.globalAlpha = 1 - fanOut;
    if (fanOut > 0) c.filter = `blur(${(fanOut * 16).toFixed(1)}px)`;
    c.translate(0, -fanOut * 160);
    POSTERS.forEach((id, i) => {
      const k = i - 3,
        rot = k * 0.085 * spread,
        x = 960 + k * 205 * spread,
        y = 560 + Math.abs(k) * 26 * spread + (1 - out5(P(l, 0.05 + i * 0.04, 0.8 + i * 0.04))) * 300;
      card(
        c,
        im(`../../../content/lessons/${id}/poster.jpg`),
        x,
        y,
        520,
        rot,
        out3(P(l, 0.05 + i * 0.04, 0.5 + i * 0.04)),
      );
    });
    c.restore();
  }
  // 2) two lesson videos
  const vin = out5(P(l, 2.3, 3.2)),
    vout = inout(P(l, 8.0, 8.7));
  if (vin > 0 && vout < 1) {
    c.save();
    c.globalAlpha = vin * (1 - vout);
    c.translate(0, (1 - vin) * 120 - vout * 80);
    if (vout > 0) c.filter = `blur(${(vout * 14).toFixed(1)}px)`;
    card(c, clip('more0', l - 0.4), 520, 470, 800, 0, 1, 'Stroke Hand Rehab', C.lagoon);
    card(c, clip('more1', l - 0.4), 1400, 470, 800, 0, 1, 'CPR Practice', C.rose);
    txt(c, 'Use exercises prescribed or approved by your physiotherapist.', 520, 820, {
      size: 21,
      w: 500,
      color: C.muted,
      track: 0,
    });
    txt(c, 'Practice aid for rhythm and straight arms only. It does not measure', 1400, 820, {
      size: 21,
      w: 500,
      color: C.muted,
      track: 0,
    });
    txt(c, 'compression depth and is not certification. Take a certified CPR course.', 1400, 850, {
      size: 21,
      w: 500,
      color: C.muted,
      track: 0,
    });
    c.restore();
    tags(c, l, [['The lesson videos  ·  what the TV plays', C.sun, 2.6, 7.9]]);
    note(c, l, 'CPR: practice for rhythm only — not certification', 4.4, 7.9, C.rose);
  }
  // 3) Together mode on the TV's lesson page
  const tin = out5(P(l, 8.4, 9.3));
  if (tin > 0) {
    c.save();
    c.globalAlpha = tin;
    c.translate(0, (1 - tin) * 140);
    const z = lerp(1.0, 1.08, P(l, 8.4, 13.8));
    c.save();
    cam(c, z, 960, 560);
    tv(c, 960, 500, 1460, (x, y, w, h) => {
      drawImg(c, clip('more2', l - 8.4), x, y, w, h);
      const ring = P(l, 10.0, 10.6);
      if (ring > 0) {
        rr(c, x + w * BTN[0] - 8, y + h * BTN[1] - 8, w * BTN[2] + 16, h * BTN[3] + 16, 14);
        c.strokeStyle = hexA(C.sun, ring);
        c.lineWidth = 5;
        c.stroke();
      }
    });
    c.restore();
    c.restore();
    tags(c, l, [['Recorded on the Vega Virtual Device', C.sky, 8.8]]);
    note(c, l, 'Together mode: two phones, one TV', 10.2, 13.6, C.sun);
  }
};
const BTN = [0.072, 0.8, 0.135, 0.052]; // "Practise together" on the lesson page, as fractions of the TV picture

// the open lesson format, typed
const ISTEP = [
  ['$ ', 'cat content/lessons/kids-forest-walk-v1/track.istep', 'cmd'],
  ['', '{', ''],
  ['  ', '"istep": "1.0",', 'kv'],
  ['  ', '"id": "kids-forest-walk-v1",', 'kv'],
  ['  ', '"title": "The Forest Walk",', 'kv'],
  ['  ', '"video": { "src": "video.mp4", "durationSec": 40 },', 'kv'],
  ['  ', '"tracking": ["pose"],', 'kv'],
  ['  ', '"gates": [', 'kv'],
  ['    ', '{ "id": "tree", "t": 7, "type": "pose_match",', 'kv'],
  ['      ', '"label": "Stretch tall like a tree",', 'kv'],
  ['      ', '"target": { "source": "angles",', 'kv'],
  ['        ', '"angles": { "l_shoulder": 165, "r_shoulder": 165, … } } },', 'kv'],
  ['    ', '…', ''],
];
function codeLine(c, s, x, y, kind, size) {
  c.save();
  c.font = `500 ${size}px "JetBrains Mono", "DejaVu Sans Mono", monospace`;
  c.textBaseline = 'alphabetic';
  if (kind === 'cmd') {
    c.fillStyle = C.ok;
    c.fillText(s, x, y);
    c.restore();
    return;
  }
  // colour keys, strings and numbers
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|([^"\d]+)/g;
  let m,
    cx = x;
  while ((m = re.exec(s))) {
    let part, col;
    if (m[1]) {
      part = m[1];
      col = m[2] ? C.sky : C.peach;
      c.fillStyle = col;
      c.fillText(part, cx, y);
      cx += c.measureText(part).width;
      if (m[2]) {
        c.fillStyle = C.muted;
        c.fillText(m[2], cx, y);
        cx += c.measureText(m[2]).width;
      }
      continue;
    }
    part = m[3] || m[4];
    col = m[3] ? C.sun : C.muted;
    c.fillStyle = col;
    c.fillText(part, cx, y);
    cx += c.measureText(part).width;
  }
  c.restore();
}
S.file = (c, l) => {
  bg(c, l, 'dark');
  const e = out5(P(l, 0.05, 0.9)),
    z = lerp(1.0, 1.06, inout(P(l, 0.5, 10.8)));
  c.save();
  cam(c, z, 960, 560);
  c.globalAlpha = e;
  c.translate(0, (1 - e) * 80);
  if (e < 1) c.filter = `blur(${((1 - e) * 12).toFixed(1)}px)`;
  const x0 = 300,
    y0 = 190,
    w = 1320,
    h = 720,
    size = 27,
    lh = 41;
  shadowed(c, 70, 30, 0.6, () => {
    rr(c, x0, y0, w, h, 22);
    c.fillStyle = '#0E0F24';
    c.fill();
  });
  rr(c, x0, y0, w, h, 22);
  c.strokeStyle = 'rgba(255,255,255,0.12)';
  c.lineWidth = 1.5;
  c.stroke();
  c.save();
  rr(c, x0, y0, w, 58, [22, 22, 0, 0]);
  c.fillStyle = '#17183A';
  c.fill();
  c.restore();
  ['#F87BAA', '#F6D653', '#49DE78'].forEach((col, i) => {
    c.beginPath();
    c.arc(x0 + 32 + i * 26, y0 + 29, 7.5, 0, 7);
    c.fillStyle = hexA(col, 0.8);
    c.fill();
  });
  txt(c, 'track.istep  ·  excerpt', x0 + w / 2, y0 + 37, { size: 21, w: 500, color: C.faint, track: 0 });
  c.filter = 'none';
  // typing: the command types, then the file prints line by line
  const tcmd = P(l, 0.6, 2.0),
    lines = (l - 2.1) / 0.32;
  ISTEP.forEach(([ind, s, kind], i) => {
    const y = y0 + 112 + i * lh;
    if (i === 0) {
      const n = Math.floor(s.length * tcmd);
      codeLine(c, '$', x0 + 44, y, 'cmd', size);
      codeLine(c, s.slice(0, n), x0 + 44 + size * 1.2, y, '', size);
      if (tcmd < 1 && Math.floor(l * 2.4) % 2 === 0) {
        c.fillStyle = C.text;
        c.fillRect(x0 + 44 + size * 1.2 + n * size * 0.6, y - size * 0.8, size * 0.55, size);
      }
      return;
    }
    if (lines < i) return;
    c.save();
    c.globalAlpha *= cl(lines - i + 1);
    codeLine(c, ind + s, x0 + 44, y, kind, size);
    c.restore();
  });
  c.restore();
  const v = vis(l, 7.6);
  txt(c, 'Open format  ·  validated with zod  ·  the same file on phone, server and TV', 960, 990 + v.dy, {
    size: 28,
    w: 500,
    color: C.muted,
    alpha: v.a,
    blur: v.blur,
    track: 0,
  });
};

// Creator Studio: a strip of phone screens, ending on the TV
S.s10 = (c, l, t) => {
  bg(c, t, 'dark');
  const k = camKeys(
    [
      [117.5, 1, 960, 540],
      [120.4, 1.12, 960, 560],
      [124.0, 1.12, 960, 560],
      [125.2, 1.12, 1430, 560],
      [127.0, 1.12, 1430, 560],
      [128.4, 0.92, 1960, 540],
    ],
    t,
  );
  c.save();
  cam(c, k.z, k.x, k.y);
  const items = [
    ['creator-new-lesson', 490, 'Name the lesson'],
    ['creator-recording', 960, 'Record once'],
    ['creator-editor', 1430, 'Steps suggested'],
  ];
  items.forEach(([name, x, cap], i) => {
    const e = spring(P(t, 117.6 + i * 0.22, 118.7 + i * 0.22));
    c.save();
    c.globalAlpha = P(t, 117.6 + i * 0.22, 118.0 + i * 0.22);
    phone(c, x, 530 + (1 - e) * 500, 680, (px, py, pw, phh) =>
      drawImg(c, im(`../../screenshots/${name}.png`), px, py, pw, phh),
    );
    txt(c, cap, x, 930 + (1 - e) * 500, { size: 28, w: 600, color: C.muted, track: 0 });
    c.restore();
  });
  // arrow + TV
  const te = out5(P(t, 126.2, 127.3));
  c.save();
  c.globalAlpha = te;
  c.translate((1 - te) * 160, 0);
  tv(
    c,
    2330,
    520,
    880,
    (x, y, w, h) => drawImg(c, clip('launcher', 21.5 + Math.max(0, t - 126.4) * 0.8), x, y, w, h),
    { stand: true },
  );
  txt(c, 'Published to the TV', 2330, 930, { size: 28, w: 600, color: C.muted, track: 0 });
  c.restore();
  c.restore();
};

S.arch = (c, l) => {
  // docs/architecture/system-diagram.html, frames pre-rendered at 1.5x; the camera follows the data
  c.fillStyle = '#F6F7FB';
  c.fillRect(0, 0, W, H);
  const k = camKeys(
    [
      [0, 1.0, 960, 540],
      [3.2, 1.6, 330, 330, 2.4],
      [6.0, 1.6, 330, 330],
      [7.6, 1.6, 980, 300, 1.4],
      [9.4, 1.6, 980, 300],
      [11.0, 1.6, 1620, 330, 1.4],
      [13.6, 1.6, 1620, 330],
      [15.2, 1.5, 560, 950, 1.5],
      [17.0, 1.5, 560, 950],
      [18.4, 1.5, 1060, 950, 1.2],
      [20.2, 1.5, 1060, 950],
      [21.9, 1.0, 960, 540, 1.6],
    ],
    l,
  );
  const hw = 960 / k.z,
    hh = 540 / k.z;
  const fx = cl(k.x, hw, W - hw),
    fy = cl(k.y, hh, H - hh);
  const i = cl(Math.floor(l * FPS), 0, TL.archFrames - 1);
  c.save();
  cam(c, k.z, fx, fy);
  drawImg(c, frameImg(`../.cache/arch2/${String(i + 1).padStart(5, '0')}.jpg`), 0, 0, W, H);
  c.restore();
};

// honesty: what is real, what is not
const HON = [
  [0.9, 'Only body points leave the phone.', 'numbers, never video  ·  measured live on the phone'],
  [3.6, 'The voices are synthetic.', 'Kokoro-82M, made on this machine'],
  [6.7, 'Coach tips are templated.', 'AWS Bedrock + Polly coach built, switched off'],
  [9.4, 'Every TV shot: a simulated learner.', 'the camera is an external phone or laptop'],
];
S.hon = (c, l) => {
  bg(c, l, 'cream');
  const y0 = 230,
    gap = 165;
  HON.forEach(([a, big, small], i) => {
    const v = vis(l, a),
      y = y0 + i * gap;
    if (v.a <= 0) return;
    txt(c, big, 960, y + v.dy, { size: 66, w: 650, color: C.ink, alpha: v.a, blur: v.blur });
    txt(c, small, 960, y + 50 + v.dy, {
      size: 26,
      w: 500,
      color: hexA(C.ink, 0.55),
      alpha: v.a,
      blur: v.blur,
      track: 0,
    });
  });
};

S.s12 = (c, l, t) => {
  // end card
  bg(c, t, 'cream');
  const mark = 150,
    word = 'InStep',
    ws = 132,
    wW = tw(c, word, ws, 700);
  const gap = 36,
    total = mark + gap + wW,
    gx = 960 - total / 2,
    my = 280;
  const lv = vis(t, 150.3);
  c.save();
  c.globalAlpha = lv.a;
  c.translate(0, lv.dy);
  logo(c, gx, my, mark, 1);
  txt(c, word, gx + mark + gap, my + mark / 2 + ws * 0.36, {
    size: ws,
    w: 700,
    align: 'left',
    color: C.ink,
    track: -0.035 * ws,
  });
  c.restore();
  const tg = vis(t, 150.9);
  txt(c, 'The video that waits for you.', 960, 560 + tg.dy, {
    size: 50,
    w: 500,
    color: hexA(C.ink, 0.72),
    alpha: tg.a,
    blur: tg.blur,
  });
  const pills = [
    'Fire TV · Vega OS',
    'Only body points leave the phone',
    'Open source · MIT',
    'Built for the Amazon Developer Hackathon',
  ];
  const pw = pills.map((s) => tw(c, s, 24, 500, 0) + 40),
    gap2 = 16,
    tot = pw.reduce((a, b) => a + b, 0) + gap2 * (pills.length - 1);
  let x = 960 - tot / 2;
  pills.forEach((s, i) => {
    const v = vis(t, 151.6 + i * 0.12, 1e9, 0.5);
    pill(c, s, x, 680 + v.dy * 0.5, {
      size: 24,
      alpha: v.a,
      color: C.ink,
      bg: 'rgba(255,255,255,0.75)',
      stroke: hexA(C.ink, 0.12),
    });
    x += pw[i] + gap2;
  });
  const uv = vis(t, 152.6);
  txt(c, 'github.com/LSUDOKO/InStep', 960, 820 + uv.dy, {
    size: 34,
    w: 600,
    color: C.ink,
    alpha: uv.a,
    track: 0,
  });
};

// ---------- frame
const BUF = [0, 1].map(() => {
  const b = document.createElement('canvas');
  b.width = W;
  b.height = H;
  return b;
});
function drawShot(c, i, t) {
  const sh = TL.shots[i];
  c.save();
  S[sh.id](c, t - sh.start, t - sh.start + (sh.legacy ?? sh.start));
  c.restore();
}
const TR = 0.7;
function draw(t) {
  const shots = TL.shots;
  let i = shots.findIndex((s) => t >= s.start && t < s.end);
  if (i < 0) i = shots.length - 1;
  let a = -1,
    b = -1,
    p = 0;
  if (i + 1 < shots.length && t > shots[i].end - TR / 2) {
    a = i;
    b = i + 1;
    p = (t - (shots[i].end - TR / 2)) / TR;
  } else if (i > 0 && t < shots[i].start + TR / 2) {
    a = i - 1;
    b = i;
    p = (t - (shots[i].start - TR / 2)) / TR;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  if (a < 0) drawShot(ctx, i, t);
  else {
    // blur push: incoming settles from 1.05 + blur; outgoing shrinks, blurs and fades on top
    const e = inout(p);
    const [A, B] = BUF.map((x) => x.getContext('2d'));
    A.setTransform(1, 0, 0, 1, 0, 0);
    B.setTransform(1, 0, 0, 1, 0, 0);
    drawShot(B, b, t);
    drawShot(A, a, t);
    ctx.save();
    cam(ctx, lerp(1.05, 1, e));
    if (e < 0.98) ctx.filter = `blur(${((1 - e) * 14).toFixed(1)}px)`;
    ctx.drawImage(BUF[1], 0, 0);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 1 - e;
    cam(ctx, lerp(1, 0.95, e));
    if (e > 0.02) ctx.filter = `blur(${(e * 18).toFixed(1)}px)`;
    ctx.drawImage(BUF[0], 0, 0);
    ctx.restore();
  }
  captions(ctx, t);
  const fo = P(t, TL.duration - 0.8, TL.duration - 0.1);
  if (fo > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fo})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

window.seek = async (t) => {
  for (let k = 0; k < 4; k++) {
    PENDING = [];
    draw(t);
    if (!PENDING.length) break;
    await Promise.all(PENDING);
  }
  return cv.toDataURL('image/jpeg', 0.93).split(',')[1];
};
(async () => {
  try {
    TL = await (await fetch('timeline.json')).json();
    for (const id of ['S1', 'S3', 'S5', 'S6'])
      WEB[id] = await (await fetch(`../assets/web/${id}.json`)).json();
    await document.fonts.load('600 40px Inter');
    await document.fonts.load('700 40px Inter');
    await document.fonts.load('500 40px Inter');
    await document.fonts.ready;
    window.__ready = true;
    const q = new URLSearchParams(location.search);
    if (q.has('t')) await window.seek(Number(q.get('t')));
  } catch (e) {
    window.__bootFailed = String((e && e.stack) || e);
  }
})();
