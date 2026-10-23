// The living room for the fall-prevention lessons (side view): blue-hour window, curtains, warm lamp, pictures,
// pendulum clock, plant, wooden floor and a sturdy dining chair. Ambient motion repeats every 10 s (or a divisor of
// 10 s), the heel-raise loop length, so the loop is seamless. No rug under the learner: loose rugs are a trip hazard.
(() => {
  const { form, fill, rrect, circle, ellipse, poly, blob, limb, shade, rgba, wave, cycle, glow, rng } = K;
  const R = (window.ROOM = {});
  R.WALL_Y = 792; // where the wall meets the floor
  R.FLOOR = 950; // where the feet stand

  const rand = rng(7);
  const MOTES = Array.from({ length: 46 }, () => [rand(), rand(), rand(), rand()]);
  const CLOUDS = [
    [0.1, 230, 120],
    [0.55, 300, 90],
    [0.82, 205, 70],
  ];
  const ROOFS = Array.from({ length: 9 }, (_, i) => [i * 62 + rand() * 20, 70 + rand() * 90, 44 + rand() * 30, rand()]);

  // ---------- back layer: wall, window, decor ----------
  R.back = (c, P, I, t) => {
    // wall: two flat tones, warm-lit toward the lamp on the right
    fill(c, rrect(-40, -40, K.W + 80, R.WALL_Y + 40, 0), I.wall);
    const g = c.createRadialGradient(1640, 380, 40, 1640, 380, 900);
    g.addColorStop(0, rgba(P.accents.peach, 0.2));
    g.addColorStop(1, rgba(P.accents.peach, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, K.W, R.WALL_Y);
    window_(c, P, I, t);
    pictures(c, P, I);
    clock(c, P, I, t);
    lamp(c, P, I, t);
    // skirting board
    fill(c, rrect(-40, R.WALL_Y - 26, K.W + 80, 26, 0), I.wallLight);
    fill(c, rrect(-40, R.WALL_Y - 26, K.W + 80, 5, 0), rgba('#ffffff', 0.12));
  };

  function window_(c, P, I, t) {
    const x = 210, y = 150, w = 420, h = 470;
    // light patch the window throws onto the wall (flat, cool)
    fill(c, poly([[x + w + 30, y + 40], [x + w + 330, y + 160], [x + w + 330, R.WALL_Y - 26], [x + w + 30, R.WALL_Y - 26]]), rgba(I.rimLight, 0.05));
    fill(c, rrect(x - 26, y - 26, w + 52, h + 64, 18), shade(I.wallLight, 1.08));
    c.save();
    c.clip(rrect(x, y, w, h, 8));
    const sky = c.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, I.skyTop);
    sky.addColorStop(1, I.skyBottom);
    c.fillStyle = sky;
    c.fillRect(x, y, w, h);
    // low warm band near the horizon (blue hour)
    fill(c, rrect(x, y + h - 170, w, 170, 0), rgba(P.accents.peach, 0.16));
    fill(c, circle(x + 300, y + 110, 34), rgba(P.text, 0.9)); // moon
    fill(c, circle(x + 314, y + 100, 30), I.skyTop);
    for (const [k, cw, ch] of CLOUDS) {
      const cx = x - 60 + k * (w + 40) + 30 * wave(t, 10, k); // drifts to and fro, 10 s period
      fill(c, blob([[cx, y + 200], [cx + cw * 0.3, y + 200 - ch * 0.5], [cx + cw * 0.65, y + 200 - ch * 0.35], [cx + cw, y + 200], [cx + cw * 0.5, y + 214]]), rgba(I.wallLight, 0.55));
    }
    for (const [rx, rh, rw, lit] of ROOFS) {
      fill(c, rrect(x + rx - 20, y + h - rh, rw + 30, rh + 10, 6), P.surface);
      if (lit > 0.35) fill(c, rrect(x + rx, y + h - rh + 22, 12, 16, 3), rgba(P.accents.sun, 0.85));
    }
    c.restore();
    // frame bars and sill
    fill(c, rrect(x + w / 2 - 8, y, 16, h, 4), shade(I.wallLight, 1.08));
    fill(c, rrect(x, y + h * 0.42 - 8, w, 16, 4), shade(I.wallLight, 1.08));
    form(c, rrect(x - 50, y + h + 20, w + 100, 30, 10), shade(I.wallLight, 1.15));
    // curtains, swaying gently (5 s period)
    for (const side of [-1, 1]) {
      const bx = side < 0 ? x - 70 : x + w + 70, sway = wave(t, 5, side < 0 ? 0 : 0.37) * 10;
      const top = y - 50, bot = y + h + 110, edge = bx - side * 95;
      const pts = [[bx, top], [edge, top], [edge - side * 12 + sway, (top + bot) / 2], [edge + side * 18 + sway * 1.6, bot], [bx, bot]];
      form(c, poly(pts), shade(P.accents.rose, 0.66), { shadow: shade(P.accents.rose, 0.5) });
      fill(c, limb([bx - side * 30, top + 20], [bx - side * 34 + sway * 0.8, bot - 10], 6, 4), rgba('#000000', 0.12));
    }
    fill(c, rrect(x - 120, y - 66, w + 240, 18, 9), shade(I.furniture, 1.1)); // curtain rail
  }

  function pictures(c, P, I) {
    const frames = [
      [1010, 210, 150, 190, P.accents.peach, P.accents.lagoon], // no sky near the figure: the TV's ghost skeleton is sky
      [1196, 250, 120, 120, P.accents.sun, P.accents.rose],
    ];
    for (const [x, y, w, h, a, b] of frames) {
      fill(c, rrect(x + 14, y + 14, w, h, 10), I.longShadow);
      form(c, rrect(x, y, w, h, 10), I.furnitureLight);
      fill(c, rrect(x + 16, y + 16, w - 32, h - 32, 6), shade(I.wall, 0.8));
      fill(c, circle(x + w * 0.38, y + h * 0.42, Math.min(w, h) * 0.2), a);
      fill(c, poly([[x + 16, y + h - 16], [x + w * 0.55, y + h * 0.5], [x + w - 16, y + h - 16]]), b);
    }
  }

  function clock(c, P, I, t) {
    const cx = 1470, cy = 300, swing = 0.2 * wave(t, 2); // pendulum, 2 s period
    fill(c, rrect(cx - 60 + 14, cy - 80 + 14, 120, 300, 30), I.longShadow);
    form(c, rrect(cx - 60, cy - 80, 120, 300, 30), I.furniture, { shadow: shade(I.furniture, 0.75) });
    fill(c, rrect(cx - 34, cy + 70, 68, 120, 18), shade(I.furniture, 0.6));
    const tip = [cx + Math.sin(swing) * 90, cy + 60 + Math.cos(swing) * 90];
    fill(c, limb([cx, cy + 60], tip, 6, 6), P.accents.sun);
    fill(c, circle(tip[0], tip[1], 16), P.accents.sun);
    fill(c, circle(cx, cy - 10, 48), P.text);
    fill(c, limb([cx, cy - 10], [cx, cy - 44], 7, 5), P.surface); // fixed hands: ten past ten
    fill(c, limb([cx, cy - 10], [cx + 24, cy - 20], 8, 6), P.surface);
    fill(c, circle(cx, cy - 10, 6), P.accents.rose);
  }

  function lamp(c, P, I, t) {
    const x = 1700, top = 330;
    glow(c, x, top + 40, 380, P.accents.sun, 0.18 + 0.02 * wave(t, 5));
    fill(c, rrect(x - 7, top + 60, 14, R.WALL_Y + 70 - top - 60, 7), shade(I.furniture, 0.8));
    fill(c, ellipse(x, R.WALL_Y + 74, 70, 16), shade(I.furniture, 0.8));
    form(c, poly([[x - 64, top], [x + 64, top], [x + 96, top + 110], [x - 96, top + 110]]), P.accents.sun, { shadow: shade(P.accents.sun, 0.82) });
    fill(c, ellipse(x, top + 110, 96, 12), shade(P.accents.peach, 1.25));
  }

  // ---------- floor ----------
  R.floor = (c, P, I, t, camx) => {
    const y0 = R.WALL_Y;
    fill(c, rrect(-40, y0, K.W + 80, K.H - y0 + 40, 0), I.floor);
    fill(c, rrect(-40, y0, K.W + 80, 70, 0), I.floorLight);
    // plank seams, converging slightly toward the wall
    c.save();
    c.translate(camx, 0);
    for (let i = -6; i < 26; i++) {
      const xb = i * 150, xt = 960 + (xb - 960) * 0.7;
      fill(c, poly([[xt - 1.5, y0], [xt + 1.5, y0], [xb + 2.5, K.H], [xb - 2.5, K.H]]), rgba('#000000', 0.14));
    }
    c.restore();
    // window light on the floor (cool, flat) with dust motes in the beam
    fill(c, poly([[300, y0], [700, y0], [1060, K.H], [420, K.H]]), rgba(I.rimLight, 0.05));
    fill(c, poly([[640, 140], [690, 140], [1200, y0], [760, y0]]), rgba(I.rimLight, 0.035));
    // rug well away from the exercise spot (loose rugs are a fall risk)
    fill(c, ellipse(1640, 1000, 200, 34), I.rug);
    fill(c, ellipse(1640, 995, 176, 26), shade(I.rug, 1.12));
  };
  R.motes = (c, P, I, t) => {
    for (const [a, b, s, ph] of MOTES) {
      const k = cycle(t, 10, a); // each mote drifts down the beam once every 10 s
      const x = 660 + b * 380 + k * 160, y = 180 + k * 560 + b * 40;
      const al = 0.25 + 0.25 * wave(t, 2.5, ph);
      fill(c, circle(x, y, 2 + s * 3), rgba(I.rimLight, al * Math.sin(Math.PI * k)));
    }
  };

  // ---------- plant (left, standing on the floor) ----------
  const LEAVES = [[-70, 1.0], [-38, 1.15], [-12, 1.25], [14, 1.2], [42, 1.1], [70, 0.95], [-55, 0.8], [55, 0.8]];
  R.plant = (c, P, I, t, x) => {
    const base = R.WALL_Y + 70;
    fill(c, ellipse(x + 30, base + 6, 100, 18), rgba(I.shadow, 0.4));
    LEAVES.forEach(([deg, len], i) => {
      const a = ((deg + 6 * wave(t, 5, i * 0.13)) * Math.PI) / 180, L = 230 * len;
      const tip = [x + Math.sin(a) * L, base - 120 - Math.cos(a) * L];
      const mid = [x + Math.sin(a) * L * 0.5, base - 120 - Math.cos(a) * L * 0.5];
      const n = [Math.cos(a) * 34, Math.sin(a) * 34];
      const col = i % 2 ? I.leafDark : I.leaf;
      form(c, blob([[x, base - 110], [mid[0] - n[0], mid[1] - n[1]], tip, [mid[0] + n[0], mid[1] + n[1]]]), col);
    });
    form(c, poly([[x - 70, base - 130], [x + 70, base - 130], [x + 52, base], [x - 52, base]]), P.accents.peach, { shadow: shade(P.accents.peach, 0.8) });
    fill(c, rrect(x - 78, base - 140, 156, 22, 10), shade(P.accents.peach, 1.1));
  };

  // ---------- the chair (side view; the back post is at x, the seat reaches right) ----------
  R.chair = (c, P, I, x, S) => {
    const F = R.FLOOR, seatY = F - 0.3 * S, topY = F - 0.6 * S, depth = 0.28 * S, wood = I.furniture, woodL = I.furnitureLight;
    const far = (dx) => dx + 14;
    // far legs (darker, offset back)
    for (const lx of [x, x + depth]) fill(c, rrect(far(lx) - 13, seatY - 12, 26, F - seatY + 2, 10), shade(wood, 0.7));
    fill(c, rrect(far(x) - 14, topY - 4, 28, seatY - topY, 12), shade(wood, 0.7));
    // seat with a rose cushion
    form(c, rrect(x - 18, seatY - 16, depth + 40, 32, 12), woodL);
    form(c, rrect(x - 4, seatY - 40, depth + 14, 30, 14), P.accents.rose, { shadow: shade(P.accents.rose, 0.75) });
    // near legs and stretcher
    form(c, rrect(x - 14, seatY, 28, F - seatY, 11), wood);
    form(c, rrect(x + depth - 14, seatY, 28, F - seatY, 11), wood);
    fill(c, rrect(x, F - 0.12 * S, depth, 18, 9), shade(wood, 0.85));
    // back post, slats and the top rail (seen end-on)
    form(c, rrect(x - 15, topY, 30, seatY - topY + 10, 12), wood);
    form(c, rrect(x - 24, topY + 0.1 * S, 48, 28, 11), woodL);
    form(c, rrect(x - 24, topY + 0.19 * S, 48, 22, 10), woodL);
    form(c, rrect(x - 30, topY - 22, 60, 44, 16), woodL);
    return [x, topY - 22]; // where hands rest
  };
})();
