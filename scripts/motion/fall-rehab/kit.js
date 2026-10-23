// Shared helpers for the fall-prevention and hand-rehab animations: timing, colour, flat shapes, on-screen labels.
// Everything is a pure function of time t (seconds) so any frame can be rendered alone and twice gives the same pixels.
(() => {
  const K = (window.K = {});
  K.W = 1920; // design coordinates; the canvas itself is scaled to 1280x720
  K.H = 1080;

  // ---------- timing ----------
  K.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  K.smooth = (x) => ((x = K.clamp(x)), x * x * (3 - 2 * x));
  K.ramp = (t, a, b) => (b > a ? K.smooth((t - a) / (b - a)) : +(t >= b)); // 0 before a, 1 after b
  K.pulse = (t, start, rise, hold, fall) =>
    K.ramp(t, start, start + rise) - K.ramp(t, start + rise + hold, start + rise + hold + fall);
  K.mix = (a, b, k) => a + (b - a) * k;
  K.lerp2 = (p, q, k) => [K.mix(p[0], q[0], k), K.mix(p[1], q[1], k)];
  // Ambient motion: every periodic thing uses a period that divides the lesson's loop length, so the frame at
  // rewindTo equals the frame at the gate time and the loop has no seam.
  // (t % period first, so whole-second boundaries give bit-identical values)
  K.wave = (t, period, phase = 0) => Math.sin(2 * Math.PI * ((t % period) / period + phase));
  K.cycle = (t, period, phase = 0) => ((((t % period) / period + phase) % 1) + 1) % 1;
  K.rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0), seed / 4294967296);

  // ---------- colour ----------
  K.rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  K.rgba = (h, a = 1) => `rgba(${K.rgb(h).join(',')},${a})`;
  K.shade = (h, k, a = 1) => {
    // k < 1 darkens toward black, k > 1 lightens toward white
    const c = K.rgb(h).map((v) => (k <= 1 ? v * k : v + (255 - v) * (k - 1)));
    return `rgba(${c.map(Math.round).join(',')},${a})`;
  };
  K.blend = (h1, h2, k) => {
    const a = K.rgb(h1), b = K.rgb(h2);
    return '#' + a.map((v, i) => Math.round(K.mix(v, b[i], k)).toString(16).padStart(2, '0')).join('');
  };

  // ---------- flat shapes (no outlines) ----------
  K.path = (fn) => {
    const p = new Path2D();
    fn(p);
    return p;
  };
  K.rrect = (x, y, w, h, r) => K.path((p) => p.roundRect(x, y, w, h, r));
  K.circle = (x, y, r) => K.path((p) => p.arc(x, y, r, 0, Math.PI * 2));
  K.ellipse = (x, y, rx, ry, a = 0) => K.path((p) => p.ellipse(x, y, rx, ry, a, 0, Math.PI * 2));
  K.poly = (pts, close = true) =>
    K.path((p) => {
      pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
      if (close) p.closePath();
    });
  // Smooth closed shape through points (Catmull-Rom as cubic Béziers).
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
  // A limb: tapered capsule from p (width w0) to q (width w1).
  K.limb = (p, q, w0, w1 = w0) =>
    K.path((s) => {
      const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
      s.arc(p[0], p[1], w0 / 2, a + Math.PI / 2, a - Math.PI / 2);
      s.arc(q[0], q[1], w1 / 2, a - Math.PI / 2, a + Math.PI / 2);
      s.closePath();
    });
  // Flat form with one light direction (upper left): shadow tone, then the base shifted toward the light leaves a
  // shadow band on the lower-right edge, and a thin highlight on the upper-left edge.
  K.form = (c, path, base, o = {}) => {
    const sh = o.shadow ?? K.shade(base, 0.78), hi = o.hi ?? 'rgba(255,255,255,0.22)';
    const [vx, vy] = o.v ?? [9, 10], [wx, wy] = o.w ?? [4, 4];
    c.save();
    c.clip(path);
    c.fillStyle = sh;
    c.fill(path);
    if (hi) {
      c.save();
      c.translate(-vx, -vy);
      c.fillStyle = base;
      c.fill(path);
      c.fillStyle = hi;
      c.fill(path);
      c.restore();
    }
    c.save();
    c.translate(-vx + wx, -vy + wy);
    c.fillStyle = base;
    c.fill(path);
    c.restore();
    c.restore();
  };
  K.fill = (c, path, col) => ((c.fillStyle = col), c.fill(path));
  K.glow = (c, x, y, r, col, a = 1) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, K.rgba(col, a));
    g.addColorStop(1, K.rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, 2 * r, 2 * r);
  };

  // ---------- on-screen text (Inter, palette surface + text colours only) ----------
  K.FONT = 'Inter, "Inter Tight", "Noto Sans", sans-serif';
  // Top-left: says what this video is, on every frame.
  K.label = (c, P, dot) => {
    c.save();
    c.font = `600 30px ${K.FONT}`;
    const text = 'Animated demonstration', w = c.measureText(text).width + 78;
    K.fill(c, K.rrect(56, 48, w, 60, 30), K.rgba(P.surface, 0.86));
    K.fill(c, K.circle(56 + 32, 78, 8), dot);
    c.fillStyle = P.text;
    c.textBaseline = 'middle';
    c.fillText(text, 56 + 52, 79);
    c.restore();
  };
  // A cue chip centred on x (e.g. "Raise 3 of 5"); `alpha` fades it; `dot` is the channel colour.
  K.chip = (c, P, text, x, y, alpha, dot) => {
    if (alpha <= 0.01) return;
    c.save();
    c.globalAlpha = alpha;
    c.font = `700 40px ${K.FONT}`;
    const tw = c.measureText(text).width, w = tw + (dot ? 100 : 72), x0 = x - w / 2;
    K.fill(c, K.rrect(x0, y, w, 76, 38), K.rgba(P.surface, 0.9));
    if (dot) K.fill(c, K.circle(x0 + 40, y + 38, 10), dot);
    c.fillStyle = P.text;
    c.textBaseline = 'middle';
    c.fillText(text, x0 + (dot ? 64 : 36), y + 40);
    c.restore();
  };
  // Fade from/to the canvas colour at the very start and end (the label is drawn after this, so it stays).
  K.fade = (c, P, t, dur) => {
    const k = Math.max(1 - K.ramp(t, 0, 0.8), K.ramp(t, dur - 0.8, dur));
    if (k > 0) K.fill(c, K.rrect(0, 0, K.W, K.H, 0), K.rgba(P.canvas, k));
  };
})();
