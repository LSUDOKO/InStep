// Shared helpers: timing curves, colour, flat outline-free shapes, labels. Everything is a pure function of t, and
// all randomness is seeded, so the same t always gives the same pixels.
(() => {
  const K = (window.KIT = {});
  K.W = 1920;
  K.H = 1080;
  K.FONT = 'Inter, "Inter Tight", "Noto Sans", sans-serif';

  // ---------- timing ----------
  K.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  K.smooth = (x) => ((x = K.clamp(x)), x * x * (3 - 2 * x));
  K.ease = (x) => ((x = K.clamp(x)), x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // cubic in-out
  K.backOut = (x, s = 1.6) => ((x = K.clamp(x) - 1), 1 + (s + 1) * x * x * x + s * x * x);
  K.ramp = (t, a, b) => (b > a ? K.smooth((t - a) / (b - a)) : +(t >= b));
  K.pulse = (t, a, rise, hold, fall) => K.ramp(t, a, a + rise) - K.ramp(t, a + rise + hold, a + rise + hold + fall);
  K.mix = (a, b, k) => a + (b - a) * k;
  K.wave = (t, period, phase = 0) => Math.sin(2 * Math.PI * (t / period + phase));
  K.cycle = (t, period, phase = 0) => (((t / period + phase) % 1) + 1) % 1;
  K.rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0), seed / 4294967296);

  // ---------- colour ----------
  K.rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  K.rgba = (h, a = 1) => `rgba(${K.rgb(h).join(',')},${a})`;
  K.shade = (h, k, a = 1) => {
    // k < 1 darkens toward black, k > 1 lightens toward white; hex in, hex out (rgba when a < 1)
    const c = K.rgb(h).map((v) => K.clamp(Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)), 0, 255));
    return a < 1 ? `rgba(${c.join(',')},${a})` : '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  K.blend = (h1, h2, k) => {
    const a = K.rgb(h1), b = K.rgb(h2);
    return '#' + a.map((v, i) => Math.round(K.mix(v, b[i], k)).toString(16).padStart(2, '0')).join('');
  };

  // ---------- flat shapes ----------
  K.fill = (c, path, style) => ((c.fillStyle = style), c.fill(path));
  K.path = (fn) => ((p) => (fn(p), p))(new Path2D());
  K.rrect = (x, y, w, h, r) => K.path((p) => p.roundRect(x, y, w, h, r));
  K.circle = (x, y, r) => K.path((p) => p.arc(x, y, Math.max(0, r), 0, Math.PI * 2));
  K.ellipse = (x, y, rx, ry, a = 0) => K.path((p) => p.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), a, 0, Math.PI * 2));
  K.poly = (pts) => K.path((p) => (pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))), p.closePath()));
  // smooth closed shape through points (Catmull-Rom as cubic Béziers)
  K.blob = (pts) =>
    K.path((p) => {
      const n = pts.length;
      p.moveTo(...pts[0]);
      for (let i = 0; i < n; i++) {
        const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n], d = pts[(i + 2) % n];
        p.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
      }
      p.closePath();
    });
  // round-capped bar from a to b, width w (limbs, fingers)
  K.capsule = (a, b, w) =>
    K.path((p) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), r = w / 2;
      if (L < 1e-3) return p.arc(a[0], a[1], r, 0, Math.PI * 2);
      const ang = Math.atan2(dy, dx);
      p.arc(a[0], a[1], r, ang + Math.PI / 2, ang - Math.PI / 2);
      p.arc(b[0], b[1], r, ang - Math.PI / 2, ang + Math.PI / 2);
      p.closePath();
    });
  // a limb with flat two-tone shading: darker underside, lighter body, one soft highlight on the upper-left edge
  K.limb = (c, a, b, w, color, dark = 0.82, hi = 0.14) => {
    K.fill(c, K.capsule(a, b, w), K.shade(color, dark));
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L; // normal pointing up-left
    if (nx + ny > 0) (nx = -nx), (ny = -ny);
    const o = w * 0.07;
    K.fill(c, K.capsule([a[0] + nx * o, a[1] + ny * o], [b[0] + nx * o, b[1] + ny * o], w * 0.84), color);
    const h = w * 0.24;
    if (hi) K.fill(c, K.capsule([a[0] + nx * h, a[1] + ny * h], [b[0] + nx * h, b[1] + ny * h], w * 0.22), `rgba(255,255,255,${hi})`);
  };
  K.star = (x, y, r1, r2, n = 5, rot = -Math.PI / 2) =>
    K.path((p) => {
      for (let i = 0; i < n * 2; i++) {
        const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
        i ? p.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)) : p.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
      }
      p.closePath();
    });
  K.heart = (x, y, s) =>
    K.path((p) => {
      p.moveTo(x, y + 0.35 * s);
      p.bezierCurveTo(x - 1.1 * s, y - 0.35 * s, x - 0.45 * s, y - 1.05 * s, x, y - 0.45 * s);
      p.bezierCurveTo(x + 0.45 * s, y - 1.05 * s, x + 1.1 * s, y - 0.35 * s, x, y + 0.35 * s);
      p.closePath();
    });
  K.glow = (c, x, y, r, color, a) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, K.rgba(color, a));
    g.addColorStop(1, K.rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, 2 * r, 2 * r);
  };

  // ---------- type ----------
  K.text = (c, s, x, y, size, color, weight = 700, align = 'center') => {
    c.font = `${weight} ${size}px ${K.FONT}`;
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    c.fillStyle = color;
    c.fillText(s, x, y);
  };
  K.textWidth = (c, s, size, weight = 700) => ((c.font = `${weight} ${size}px ${K.FONT}`), c.measureText(s).width);
  // Top-left honesty label (same place as the other animated lessons): a dark pill with a dot in the channel colour.
  K.label = (c, s, dot) => {
    const w = K.textWidth(c, s, 30, 700) + 82;
    K.fill(c, K.rrect(64, 56, w, 60, 30), 'rgba(5,4,27,0.62)');
    K.fill(c, K.circle(94, 86, 8), dot);
    K.text(c, s, 116, 97, 30, 'rgba(245,246,254,0.95)', 700, 'left');
  };
  K.fade = (c, t, dur, k0 = 0.6, k1 = 0.8) => {
    const k = Math.max(1 - K.ramp(t, 0, k0), K.ramp(t, dur - k1, dur));
    if (k > 0) (c.fillStyle = `rgba(5,4,27,${k})`), c.fillRect(0, 0, K.W, K.H);
  };
  // burst of stars and sparkles that starts at t0 (celebration after a step)
  K.burst = (c, t, t0, x, y, colors, seed = 1, n = 14, R = 260) => {
    const k = (t - t0) / 1.4;
    if (k <= 0 || k >= 1) return;
    const rnd = K.rng(seed);
    const ring = K.smooth(k / 0.5);
    c.save();
    c.globalAlpha = 1 - K.smooth((k - 0.3) / 0.7);
    c.lineWidth = 10 * (1 - k);
    c.strokeStyle = K.rgba(colors[0], 0.8);
    c.beginPath();
    c.arc(x, y, R * 0.3 + R * 0.9 * ring, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.4, d = R * (0.35 + 0.75 * rnd()) * K.backOut(k * 1.4, 1.2);
      const s = (16 + 22 * rnd()) * (1 - 0.6 * k), col = colors[i % colors.length];
      K.fill(c, K.star(x + Math.cos(a) * d, y + Math.sin(a) * d - 60 * k * k, s, s * 0.45, 5, k * 3 + i), col);
    }
    c.restore();
  };
  K.sparkle = (c, x, y, r, color, a = 1) => {
    if (a <= 0.01 || r <= 0.5) return;
    K.fill(c, K.path((p) => {
      p.moveTo(x, y - r);
      p.quadraticCurveTo(x, y, x + r, y);
      p.quadraticCurveTo(x, y, x, y + r);
      p.quadraticCurveTo(x, y, x - r, y);
      p.quadraticCurveTo(x, y, x, y - r);
    }), K.rgba(color, a));
  };
})();
