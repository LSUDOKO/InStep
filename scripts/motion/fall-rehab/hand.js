// Hand-rehab scene: a table close-up, forearm resting on a folded towel, palm to the camera. The hand opens fully
// and closes to a soft fist. Ambient motion (steam, plant, light) repeats every 4 s or a divisor of it, the length
// of the lesson's loop (4 s -> 8 s), so the loop has no seam.
(() => {
  const { form, fill, rrect, circle, ellipse, poly, blob, limb, shade, rgba, wave, cycle, glow, mix, rng } = K;
  const HAND = (window.HAND = {});
  const TABLE_Y = 790;
  const rand = rng(11);
  const MOTES = Array.from({ length: 30 }, () => [rand(), rand(), rand(), rand()]);

  HAND.room = (c, P, I, t) => {
    fill(c, rrect(-20, -20, K.W + 40, TABLE_Y + 40, 0), I.wall);
    glow(c, 1560, 260, 760, P.accents.sun, 0.16 + 0.02 * wave(t, 4));
    // window on the left, blue hour outside
    const x = 120, y = 110, w = 440, h = 520;
    fill(c, rrect(x - 24, y - 24, w + 48, h + 48, 16), shade(I.wallLight, 1.08));
    c.save();
    c.clip(rrect(x, y, w, h, 8));
    const sky = c.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, I.skyTop);
    sky.addColorStop(1, I.skyBottom);
    c.fillStyle = sky;
    c.fillRect(x, y, w, h);
    fill(c, rrect(x, y + h - 160, w, 160, 0), rgba(P.accents.peach, 0.16));
    for (let i = 0; i < 7; i++) fill(c, rrect(x + i * 68 - 10, y + h - 90 - ((i * 37) % 60), 56, 200, 6), P.surface);
    for (let i = 0; i < 7; i += 2) fill(c, rrect(x + i * 68 + 8, y + h - 60 - ((i * 37) % 60), 12, 16, 3), rgba(P.accents.sun, 0.85));
    c.restore();
    fill(c, rrect(x + w / 2 - 8, y, 16, h, 4), shade(I.wallLight, 1.08));
    fill(c, rrect(x, y + h * 0.45 - 8, w, 16, 4), shade(I.wallLight, 1.08));
    // light from the window on the wall, with motes
    fill(c, poly([[x + w + 20, y + 40], [x + w + 420, y + 200], [x + w + 420, TABLE_Y], [x + w + 20, TABLE_Y]]), rgba(I.rimLight, 0.045));
    for (const [a, b, s, ph] of MOTES) {
      const k = cycle(t, 4, a), px = x + w + 40 + b * 360, py = y + 120 + k * 520;
      fill(c, circle(px + 20 * Math.sin(Math.PI * 2 * (k + ph)), py, 2 + s * 3), rgba(I.rimLight, (0.2 + 0.2 * wave(t, 2, ph)) * Math.sin(Math.PI * k)));
    }
    // picture and plant on the right
    fill(c, rrect(1330 + 14, 170 + 14, 210, 160, 12), I.longShadow);
    form(c, rrect(1330, 170, 210, 160, 12), I.furnitureLight);
    fill(c, rrect(1348, 188, 174, 124, 6), shade(I.wall, 0.8));
    fill(c, circle(1400, 240, 30), P.accents.sun);
    fill(c, poly([[1348, 312], [1440, 230], [1522, 312]]), P.accents.lagoon);
    plant(c, P, I, t, 1690);
  };

  function plant(c, P, I, t, x) {
    const base = TABLE_Y + 10;
    [[-62, 1.0], [-30, 1.2], [-6, 1.3], [20, 1.18], [48, 1.0], [72, 0.85]].forEach(([deg, len], i) => {
      const a = ((deg + 5 * wave(t, 4, i * 0.17)) * Math.PI) / 180, L = 250 * len;
      const tip = [x + Math.sin(a) * L, base - 150 - Math.cos(a) * L], mid = [x + Math.sin(a) * L * 0.5, base - 150 - Math.cos(a) * L * 0.5];
      const n = [Math.cos(a) * 38, Math.sin(a) * 38];
      form(c, blob([[x, base - 140], [mid[0] - n[0], mid[1] - n[1]], tip, [mid[0] + n[0], mid[1] + n[1]]]), i % 2 ? I.leafDark : I.leaf);
    });
    form(c, poly([[x - 80, base - 160], [x + 80, base - 160], [x + 60, base], [x - 60, base]]), P.accents.peach, { shadow: shade(P.accents.peach, 0.8) });
  }

  HAND.table = (c, P, I, t) => {
    form(c, rrect(-40, TABLE_Y, K.W + 80, 400, 0), I.furnitureLight, { v: [0, 14], w: [0, 6] });
    fill(c, rrect(-40, TABLE_Y + 210, K.W + 80, 400, 0), I.furniture); // front edge
    fill(c, rrect(-40, TABLE_Y + 210, K.W + 80, 10, 0), rgba('#ffffff', 0.12));
    // mug with steam (left), notebook and pencil (right)
    const mx = 420, my = TABLE_Y + 120;
    fill(c, ellipse(mx + 40, my + 8, 110, 16), rgba(I.shadow, 0.4));
    form(c, rrect(mx - 70, my - 150, 140, 158, 26), P.accents.rose, { shadow: shade(P.accents.rose, 0.75) });
    fill(c, limb([mx + 70, my - 110], [mx + 70, my - 50], 50, 50), shade(P.accents.rose, 0.75));
    fill(c, limb([mx + 70, my - 110], [mx + 70, my - 50], 22, 22), I.furnitureLight);
    fill(c, ellipse(mx, my - 148, 62, 12), shade(I.furniture, 0.6));
    for (let i = 0; i < 3; i++) {
      const k = cycle(t, 2, i / 3), sx = mx - 30 + i * 30, sy = my - 170 - k * 170;
      fill(c, limb([sx + 14 * Math.sin(Math.PI * 2 * (k + i * 0.3)), sy], [sx + 14 * Math.sin(Math.PI * 2 * (k + 0.25 + i * 0.3)), sy - 60], 16, 6), rgba(P.text, 0.22 * Math.sin(Math.PI * k)));
    }
    const nx = 1430, ny = TABLE_Y + 70;
    fill(c, poly([[nx + 20, ny + 20], [nx + 300, ny + 20], [nx + 330, ny + 120], [nx + 40, ny + 120]].map(([a, b]) => [a + 12, b + 12])), I.longShadow);
    form(c, poly([[nx + 20, ny + 20], [nx + 300, ny + 20], [nx + 330, ny + 120], [nx + 40, ny + 120]]), P.accents.sky, { shadow: shade(P.accents.sky, 0.78) });
    fill(c, limb([nx + 90, ny + 70], [nx + 280, ny + 54], 14, 14), P.accents.sun);
    fill(c, ellipse(980, TABLE_Y + 196, 260, 24), rgba(I.shadow, 0.4));
  };
  // folded towel under the elbow (drawn over the bottom of the sleeve)
  function towel(c, P, I) {
    form(c, rrect(740, TABLE_Y + 104, 480, 88, 36), I.clothes[6], { shadow: shade(I.clothes[6], 0.8) });
    fill(c, rrect(760, TABLE_Y + 134, 440, 10, 5), rgba(P.channel, 0.5));
  }

  // ---------- the hand (palm towards the camera) ----------
  const FINGERS = [ // x offset from palm centre, length factor, spread (deg)
    [-0.33, 0.8, -10],
    [-0.11, 1.0, -3],
    [0.11, 1.07, 3],
    [0.33, 0.97, 9],
  ];
  // `close` 0 = open, 1 = soft fist. Fingers curl toward the camera: each joint's angle is projected onto the screen
  // (cos of the accumulated flexion), so a curled finger folds down over the palm and shows its back and nail.
  HAND.draw = (c, P, I, cx, cy, u, close) => {
    const skin = I.skinTone;
    // forearm and sleeve, resting on the towel
    const elbow = [cx + 0.1 * u, TABLE_Y + 40], wrist = [cx, cy + 0.55 * u], cuff = K.lerp2(elbow, wrist, 0.5);
    form(c, limb(elbow, wrist, 0.8 * u, 0.6 * u), skin, { shadow: shade(skin, 0.84), v: [14, 0], w: [6, 0] });
    fill(c, limb([cx - 0.18 * u, cy + 0.66 * u], [cx + 0.2 * u, cy + 0.62 * u], 0.03 * u, 0.03 * u), rgba(I.shadow, 0.12)); // wrist crease
    form(c, limb(elbow, cuff, 0.98 * u, 0.84 * u), P.channel, { shadow: shade(P.channel, 0.78), v: [16, 4], w: [6, 2] });
    fill(c, limb(K.lerp2(elbow, wrist, 0.44), cuff, 0.86 * u, 0.84 * u), shade(P.channel, 1.18)); // pushed-up cuff
    towel(c, P, I);
    // palm with the thumb's muscle (right side) and creases that hide as the hand closes
    const palm = blob([[cx - 0.5 * u, cy - 0.46 * u], [cx, cy - 0.53 * u], [cx + 0.5 * u, cy - 0.44 * u], [cx + 0.54 * u, cy + 0.1 * u], [cx + 0.38 * u, cy + 0.56 * u], [cx - 0.02 * u, cy + 0.68 * u], [cx - 0.4 * u, cy + 0.5 * u], [cx - 0.54 * u, cy + 0.02 * u]]);
    form(c, palm, skin, { shadow: shade(skin, 0.84), v: [14, 14], w: [6, 6] });
    form(c, ellipse(cx + 0.27 * u, cy + 0.32 * u, 0.24 * u, 0.3 * u, -0.4), shade(skin, 1.04), { shadow: shade(skin, 0.9), hi: null, v: [8, 8], w: [0, 0] });
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = rgba(I.shadow, 0.16 * (1 - close));
    c.lineWidth = 0.025 * u;
    c.beginPath();
    c.moveTo(cx - 0.44 * u, cy - 0.16 * u);
    c.quadraticCurveTo(cx - 0.05 * u, cy - 0.05 * u, cx + 0.42 * u, cy - 0.22 * u);
    c.moveTo(cx - 0.42 * u, cy + 0.04 * u);
    c.quadraticCurveTo(cx - 0.05 * u, cy + 0.08 * u, cx + 0.12 * u, cy + 0.0 * u);
    c.moveTo(cx + 0.12 * u, cy - 0.08 * u);
    c.quadraticCurveTo(cx + 0.02 * u, cy + 0.3 * u, cx + 0.06 * u, cy + 0.58 * u);
    c.stroke();
    c.restore();
    // fingers, back to front by depth
    const flex = [75, 98, 55].map((d) => (d * Math.PI * close) / 180), segs = [];
    for (const [fx, fl, spread] of FINGERS) {
      let p = [cx + fx * u, cy - 0.44 * u], cum = 0, depth = 0;
      const sp = (spread * Math.PI * (1 - close)) / 180, lens = [0.45, 0.3, 0.24].map((k) => k * fl * u);
      lens.forEach((ln, i) => {
        cum += flex[i];
        const q = [p[0] + ln * Math.sin(sp) * Math.cos(cum), p[1] - ln * Math.cos(sp) * Math.cos(cum)], d2 = depth + ln * Math.sin(cum);
        segs.push({ z: (depth + d2) / 2, p, q, cum, tip: i === 2, w: 0.2 * u * (1 - 0.08 * i) });
        p = q;
        depth = d2;
      });
    }
    segs.sort((a, b) => a.z - b.z);
    for (const s of segs) {
      const k = 0.86 + 0.18 * Math.abs(Math.cos(s.cum)) + (s.cum > Math.PI / 2 ? 0.04 : 0);
      form(c, limb(s.p, s.q, s.w, s.w * 0.94), shade(skin, k), { shadow: shade(skin, k * 0.86), v: [6, 4], w: [3, 2] });
      if (s.tip && s.cum > (150 * Math.PI) / 180) fill(c, rrect(s.q[0] - s.w * 0.3, s.q[1] - s.w * 0.18, s.w * 0.6, s.w * 0.5, s.w * 0.22), shade(skin, 1.3)); // nail
      if (!s.tip && s.cum < 0.6) fill(c, limb([s.q[0] - s.w * 0.28, s.q[1]], [s.q[0] + s.w * 0.28, s.q[1]], s.w * 0.08, s.w * 0.08), rgba(I.shadow, 0.14)); // joint crease
    }
    // thumb: out to the side when open, across the curled fingers when closed
    const root = [cx + 0.32 * u, cy + 0.36 * u], a1 = ((mix(-30, -82, close)) * Math.PI) / 180, ang = ((mix(-40, -166, close)) * Math.PI) / 180;
    const mid = [root[0] + 0.4 * u * Math.cos(a1), root[1] + 0.4 * u * Math.sin(a1)];
    const tl = mix(0.32, 0.34, close) * u, tip = [mid[0] + tl * Math.cos(ang), mid[1] + tl * Math.sin(ang)];
    form(c, limb(root, mid, 0.3 * u, 0.22 * u), shade(skin, 0.98), { shadow: shade(skin, 0.84), v: [6, 4], w: [3, 2] });
    form(c, limb(mid, tip, 0.21 * u, 0.19 * u), shade(skin, 1.02), { shadow: shade(skin, 0.8), v: [7, 7], w: [3, 3] });
  };
})();
