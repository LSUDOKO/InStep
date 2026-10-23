// The Forest Walk: a child walks through a blue-hour forest and copies a tree, a mouse, a flamingo, then waves
// goodbye to the forest friends. Every pose is fully formed 3.2 s before its gate time and held 0.6 s after it (the TV
// pauses at t); the celebration starts 0.6 s after the gate, when the video is playing again. Times come from the
// gates in track.istep. The child faces us and waves with the arm on the viewer's right, so a child copying the TV
// like a mirror raises their own right arm (the wave gate checks the right shoulder).
(() => {
  const {
    fill,
    rrect,
    circle,
    ellipse,
    blob,
    poly,
    limb,
    text,
    textWidth,
    rgba,
    shade,
    blend,
    ramp,
    smooth,
    ease,
    backOut,
    mix,
    wave,
    cycle,
    rng,
    glow,
    sparkle,
    burst,
    label,
  } = KIT;

  const GROUND = 846; // where the child's feet stand
  const CX = 700; // the child's screen x
  const STATION = 1500; // world distance between scenes

  // ---- poses: elbow/hand relative to each shoulder, knee/foot relative to the pelvis; L = viewer's left ----
  const STAND = {
    py: 0,
    dx: 0,
    aL: [
      [-18, 90],
      [-26, 178],
    ],
    aR: [
      [18, 90],
      [26, 178],
    ],
    lL: [
      [-38, 112],
      [-42, 226],
    ],
    lR: [
      [38, 112],
      [42, 226],
    ],
  };
  const POSES = {
    stand: STAND,
    // arms straight up beside the head (shoulder ~165 deg, elbows straight)
    tree: {
      ...STAND,
      aL: [
        [-30, -92],
        [-58, -180],
      ],
      aR: [
        [30, -92],
        [58, -180],
      ],
    },
    // knees out, low (2D knee angle ~95 deg seen from the front), paws by the chin
    mouse: {
      py: 96,
      dx: 0,
      aL: [
        [-48, 62],
        [-18, -6],
      ],
      aR: [
        [48, 62],
        [18, -6],
      ],
      lL: [
        [-128, 36],
        [-98, 130],
      ],
      lR: [
        [128, 36],
        [98, 130],
      ],
    },
    // standing on the viewer's-left leg, the other knee up and its foot tucked, arms out like wings
    flamingo: {
      py: 0,
      dx: -12,
      aL: [
        [-90, 6],
        [-178, -14],
      ],
      aR: [
        [90, 6],
        [178, -14],
      ],
      lL: [
        [-34, 112],
        [-36, 226],
      ],
      lR: [
        [64, 38],
        [16, 118],
      ],
    },
    // viewer's-right arm up and out (shoulder ~127 deg), forearm up; the hand waves on top of this
    wave: {
      ...STAND,
      aR: [
        [78, -58],
        [104, -146],
      ],
    },
  };
  const mixPose = (a, b, k) => {
    const m = (x, y) => (Array.isArray(x) ? x.map((v, i) => m(v, y[i])) : mix(x, y, k));
    return Object.fromEntries(Object.keys(a).map((key) => [key, m(a[key], b[key])]));
  };

  window.KIDS = (track, P) => {
    const I = P.illustration;
    const dur = track.video.durationSec;
    const G = Object.fromEntries(track.gates.map((g) => [g.id, g]));
    const order = ['tree', 'mouse', 'flamingo', 'wave'];
    const T = order.map((id) => G[id].t);
    const C = {
      skin: P.skin[3],
      hair: I.hair[0],
      shirt: P.channels.kids,
      shorts: I.pants[0],
      shoe: P.accents.rose,
      leaf: I.leaf,
      leafDark: I.leafDark,
      trunk: I.furniture,
      trunkLight: I.furnitureLight,
    };

    // ---- schedule: walk to scene i, pose i in (formed 3.2 s before t), hold to t + 0.6, then out ----
    const walks = T.map((t, i) => [i ? T[i - 1] + 1.2 : 0, t - 4.2]);
    const camAt = (t) => {
      let x = -STATION * 0.95;
      walks.forEach(([a, b], i) => {
        const from = i ? (i - 1) * STATION : -STATION * 0.95,
          to = i * STATION;
        if (t >= b) x = to;
        else if (t > a) x = mix(from, to, ease((t - a) / (b - a)));
      });
      return x;
    };
    const walking = (t) =>
      walks.reduce((m, [a, b]) => Math.max(m, ramp(t, a, a + 0.35) - ramp(t, b - 0.35, b)), 0);
    const poseAt = (t) => {
      let p = STAND;
      order.forEach((id, i) => {
        const on = ramp(t, T[i] - 3.9, T[i] - 3.2) - (id === 'wave' ? 0 : ramp(t, T[i] + 0.6, T[i] + 1.2));
        if (on > 0) p = mixPose(STAND, POSES[id], ease(on));
      });
      return p;
    };

    const rnd = rng(5);
    const STARS = Array.from({ length: 60 }, () => [rnd() * 1920, rnd() * 420, rnd(), rnd()]);
    const HILLS = Array.from({ length: 14 }, (_, i) => [
      i * 360 + rnd() * 120,
      120 + rnd() * 110,
      260 + rnd() * 160,
    ]);
    const BACK_TREES = Array.from({ length: 26 }, (_, i) => [
      i * 260 + rnd() * 120,
      0.75 + rnd() * 0.5,
      rnd(),
    ]);
    const TUFTS = Array.from({ length: 40 }, (_, i) => [i * 190 + rnd() * 90, rnd(), rnd()]);
    const FLIES = Array.from({ length: 28 }, () => [rnd(), rnd(), rnd(), rnd()]);

    // ---------- world ----------
    const sky = (c, t) => {
      const g = c.createLinearGradient(0, 0, 0, GROUND);
      g.addColorStop(0, I.skyTop);
      g.addColorStop(0.75, I.skyBottom);
      g.addColorStop(1, blend(I.skyBottom, P.accents.peach, 0.35));
      c.fillStyle = g;
      c.fillRect(0, 0, 1920, GROUND + 20);
      for (const [x, y, s, ph] of STARS)
        sparkle(c, x, y, 2 + 5 * s, P.text, 0.15 + 0.45 * s * (0.5 + 0.5 * wave(t, 2 + 3 * s, ph)));
      // a big low sun, slowly setting through the story
      const sy = 470 + 90 * (t / dur);
      glow(c, 1420, sy, 520, P.accents.peach, 0.32);
      fill(c, circle(1420, sy, 150), blend(P.accents.sun, P.accents.peach, 0.25));
      fill(c, circle(1420, sy, 118), P.accents.sun);
      // drifting clouds
      [
        [0.1, 220, 1],
        [0.45, 150, 0.7],
        [0.78, 300, 0.85],
      ].forEach(([k, y, s]) => {
        const x = ((k * 2600 + t * 22 * s) % 2600) - 340;
        fill(
          c,
          blob([
            [x, y],
            [x + 90 * s, y - 50 * s],
            [x + 200 * s, y - 40 * s],
            [x + 290 * s, y],
            [x + 150 * s, y + 18 * s],
          ]),
          rgba(I.wallLight, 0.7),
        );
      });
    };
    const hills = (c, cam) => {
      const o = cam * 0.12;
      for (const [x, h, w] of HILLS) {
        const sx = ((((x - o) % 5040) + 5040) % 5040) - 400;
        fill(c, ellipse(sx, GROUND - 40, w, h + 60), blend(I.skyBottom, I.leafDark, 0.45));
      }
      const o2 = cam * 0.35;
      for (const [x, s, ph] of BACK_TREES) {
        const sx = ((((x - o2) % 6760) + 6760) % 6760) - 300;
        const h = 300 * s,
          y = GROUND - 30;
        fill(c, rrect(sx - 8, y - h * 0.45, 16, h * 0.45, 6), shade(I.leafDark, 0.55));
        fill(c, ellipse(sx, y - h * 0.62, 70 * s, h * 0.42), blend(I.leafDark, I.skyBottom, 0.35 + 0.2 * ph));
      }
    };
    const ground = (c, cam, t) => {
      fill(c, rrect(-20, GROUND - 40, 1960, 300, 0), shade(I.leafDark, 0.62));
      fill(c, rrect(-20, GROUND - 40, 1960, 14, 0), shade(I.leaf, 0.8));
      // the path
      fill(
        c,
        poly([
          [-20, GROUND - 10],
          [1940, GROUND - 10],
          [1940, GROUND + 70],
          [-20, GROUND + 70],
        ]),
        shade(I.furnitureLight, 0.62),
      );
      fill(c, rrect(-20, GROUND - 10, 1960, 8, 0), shade(I.furnitureLight, 0.78));
      for (let i = 0; i < 16; i++) {
        const sx = ((((i * 260 - cam) % 4160) + 4160) % 4160) - 200;
        fill(c, ellipse(sx, GROUND + 30 + (i % 3) * 10, 26, 7), shade(I.furnitureLight, 0.5));
      }
      void t;
    };
    const tufts = (c, cam, t, front) => {
      for (const [x, s, ph] of TUFTS) {
        if (s > 0.6 !== front) continue;
        const sx = ((((x - cam * (front ? 1.25 : 1)) % 7600) + 7600) % 7600) - 200;
        const y = front ? 1040 : GROUND - 18,
          h = (front ? 70 : 34) * (0.7 + s * 0.6),
          sw = 8 * wave(t, 2.4, ph);
        for (let k = -1; k <= 1; k++)
          fill(
            c,
            poly([
              [sx + k * 14 - 7, y],
              [sx + k * 14 + 7, y],
              [sx + k * 22 + sw, y - h * (k ? 0.75 : 1)],
            ]),
            front ? shade(I.leafDark, 0.45) : shade(I.leaf, 0.75),
          );
        if (!front && ph > 0.6) {
          const fx = sx + 30,
            fy = y - 30 + 4 * wave(t, 2.4, ph);
          for (let k = 0; k < 5; k++)
            fill(
              c,
              circle(fx + 9 * Math.cos(k * 1.257), fy + 9 * Math.sin(k * 1.257), 7),
              [P.accents.rose, P.accents.sun, P.accents.sky][Math.floor(ph * 10) % 3],
            );
          fill(c, circle(fx, fy, 5), P.accents.peach);
        }
      }
    };
    // foreground meadow below the path (parallax 1.2): bushes, flowers, stones and grass
    const MEADOW = Array.from({ length: 60 }, (_, i) => [i * 150 + rnd() * 110, rnd(), rnd(), rnd()]);
    const meadow = (c, cam, t) => {
      const span = 9000;
      for (const [x, a, b, ph] of MEADOW) {
        const sx = ((((x - cam * 1.2) % span) + span) % span) - 200;
        if (sx < -260 || sx > 2180) continue;
        const y = 950 + a * 110,
          sw = 6 * wave(t, 2.6, ph);
        if (b < 0.22) {
          const r = 70 + 50 * a;
          fill(
            c,
            blob([
              [sx - r, y + 20],
              [sx - r * 0.6, y - r * 0.7],
              [sx, y - r],
              [sx + r * 0.7, y - r * 0.6],
              [sx + r, y + 20],
            ]),
            shade(I.leafDark, 0.82 + 0.2 * ph),
          );
          fill(
            c,
            blob([
              [sx - r * 0.6, y - r * 0.3],
              [sx - r * 0.2, y - r * 0.8],
              [sx + r * 0.2, y - r * 0.6],
              [sx - r * 0.1, y - r * 0.3],
            ]),
            rgba('#ffffff', 0.08),
          );
        } else if (b < 0.62) {
          const col = [P.accents.rose, P.accents.sun, P.accents.sky, P.accents.peach, P.accents.iris][
            Math.floor(ph * 5)
          ];
          const h = 40 + 40 * a;
          c.lineWidth = 6;
          c.lineCap = 'round';
          c.strokeStyle = shade(I.leaf, 0.7);
          c.beginPath();
          c.moveTo(sx, y + 10);
          c.quadraticCurveTo(sx + sw, y - h * 0.5, sx + sw * 1.6, y - h);
          c.stroke();
          const fx = sx + sw * 1.6,
            fy = y - h;
          for (let k = 0; k < 6; k++)
            fill(
              c,
              ellipse(
                fx + 13 * Math.cos(k * 1.047 + ph),
                fy + 13 * Math.sin(k * 1.047 + ph),
                10,
                7,
                k * 1.047 + ph,
              ),
              col,
            );
          fill(c, circle(fx, fy, 7), b < 0.4 ? P.accents.sun : P.text);
        } else if (b < 0.72) {
          fill(c, ellipse(sx, y + 6, 34 + 20 * a, 18 + 8 * a), shade(P.neutral, 0.62));
          fill(c, ellipse(sx - 8, y, 18 + 10 * a, 7), shade(P.neutral, 0.82));
        } else {
          for (let k = -2; k <= 2; k++)
            fill(
              c,
              poly([
                [sx + k * 12 - 6, y + 12],
                [sx + k * 12 + 6, y + 12],
                [sx + k * 20 + sw, y - (46 + 30 * a) * (1 - Math.abs(k) * 0.2)],
              ]),
              shade(I.leaf, 0.55 + 0.15 * ph),
            );
        }
      }
    };
    const fireflies = (c, t) => {
      for (const [x, y, s, ph] of FLIES) {
        const fx = x * 1920 + 40 * wave(t, 5 + 4 * s, ph),
          fy = 260 + y * 520 + 30 * wave(t, 4 + 3 * s, ph + 0.3);
        const a = 0.25 + 0.6 * Math.max(0, wave(t, 1.8 + s, ph));
        glow(c, fx, fy, 22, P.accents.sun, 0.35 * a);
        fill(c, circle(fx, fy, 3.5), rgba(P.accents.sun, a));
      }
    };
    const contact = (c, x, w) => fill(c, ellipse(x, GROUND + 6, w, w * 0.16), rgba(I.shadow, 0.4));

    // ---------- the friends ----------
    const tree = (c, x, t, k) => {
      const sway = 0.035 * wave(t, 3.2) + 0.05 * k * wave(t, 1.6, 0.2);
      contact(c, x, 190);
      c.save();
      c.translate(x, GROUND);
      c.scale(0.9, 0.9);
      fill(
        c,
        poly([
          [-46, 0],
          [46, 0],
          [26, -330],
          [-26, -330],
        ]),
        C.trunk,
      );
      fill(
        c,
        poly([
          [-46, 0],
          [-18, 0],
          [-10, -330],
          [-26, -330],
        ]),
        C.trunkLight,
      );
      c.rotate(sway);
      fill(
        c,
        poly([
          [-22, -300],
          [-12, -320],
          [-120, -440],
          [-136, -428],
        ]),
        C.trunk,
      ); // branches up like arms
      fill(
        c,
        poly([
          [22, -300],
          [12, -320],
          [120, -450],
          [136, -438],
        ]),
        C.trunk,
      );
      fill(
        c,
        blob([
          [-250, -470],
          [-170, -640],
          [0, -720],
          [170, -640],
          [250, -470],
          [120, -380],
          [-120, -380],
        ]),
        C.leafDark,
      );
      fill(
        c,
        blob([
          [-210, -500],
          [-140, -650],
          [0, -700],
          [140, -650],
          [210, -500],
          [80, -420],
          [-90, -430],
        ]),
        C.leaf,
      );
      fill(
        c,
        blob([
          [-170, -560],
          [-90, -660],
          [10, -680],
          [-30, -600],
          [-120, -520],
        ]),
        shade(C.leaf, 1.18),
      );
      for (let i = 0; i < 5; i++)
        fill(c, circle(-120 + i * 60, -520 - 60 * Math.sin(i * 1.3), 14), P.accents.rose); // blossoms
      c.restore();
      // falling leaves
      for (let i = 0; i < 6; i++) {
        const q = cycle(t, 4.5, i / 6),
          lx = x - 200 + i * 80 + 40 * wave(t, 2, i / 6),
          ly = GROUND - 640 + q * 620;
        c.save();
        c.translate(lx, ly);
        c.rotate(t * 2 + i);
        fill(c, ellipse(0, 0, 14, 7), rgba(i % 2 ? C.leaf : P.accents.sun, 1 - smooth((q - 0.8) / 0.2)));
        c.restore();
      }
    };
    const mouse = (c, x, t, sitUp, s = 1, wavePaw = 0) => {
      const hop = Math.abs(wave(t, 0.36)) * 10 * (1 - sitUp);
      const fur = blend(P.neutral, P.textMuted, 0.35);
      contact(c, x, 70 * s);
      c.save();
      c.translate(x, GROUND - hop);
      c.scale(s, s);
      // tail
      c.lineWidth = 7;
      c.lineCap = 'round';
      c.strokeStyle = shade(P.accents.rose, 0.85);
      c.beginPath();
      c.moveTo(48, -20);
      c.quadraticCurveTo(110, -20 + 30 * wave(t, 1.1), 130, -70 + 16 * wave(t, 1.1, 0.3));
      c.stroke();
      const lift = sitUp * 40;
      fill(c, ellipse(0, -48 - lift * 0.5, 62 - sitUp * 18, 48 + lift * 0.5), fur);
      fill(c, ellipse(-8, -40 - lift * 0.4, 34, 30 + lift * 0.3), shade(fur, 1.18)); // belly
      const hx = -42 + sitUp * 40,
        hy = -82 - lift;
      fill(c, circle(hx - 26, hy - 40, 26), fur); // ears
      fill(c, circle(hx - 26, hy - 40, 15), P.accents.rose);
      fill(c, circle(hx + 26, hy - 42, 26), fur);
      fill(c, circle(hx + 26, hy - 42, 15), P.accents.rose);
      fill(c, ellipse(hx, hy, 40, 34), fur);
      fill(c, circle(hx - 13, hy - 4, 6), I.shadow);
      fill(c, circle(hx + 13, hy - 4, 6), I.shadow);
      fill(c, circle(hx - 11, hy - 6, 2), P.text);
      fill(c, circle(hx + 15, hy - 6, 2), P.text);
      fill(c, circle(hx, hy + 14 + 2 * wave(t, 0.5), 8), P.accents.rose);
      // paws by the chin (or one waving)
      fill(c, circle(hx - 20, hy + 44 - 30 * wavePaw, 10), shade(fur, 1.12));
      fill(c, circle(hx + 20 + 14 * wavePaw * wave(t, 0.5), hy + 44 - 70 * wavePaw, 10), shade(fur, 1.12));
      c.restore();
    };
    const pond = (c, x, t) => {
      fill(c, ellipse(x, GROUND + 34, 330, 62), shade(P.accents.lagoon, 0.42));
      fill(c, ellipse(x, GROUND + 30, 300, 50), shade(P.accents.lagoon, 0.62));
      for (let i = 0; i < 3; i++) {
        const q = cycle(t, 2.4, i / 3);
        c.lineWidth = 3;
        c.strokeStyle = rgba(P.accents.lagoon, 0.7 * (1 - q));
        c.beginPath();
        c.ellipse(x + 20, GROUND + 30, 40 + 160 * q, 8 + 30 * q, 0, 0, Math.PI * 2);
        c.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const rx = x - 300 + i * 26,
          sw = 6 * wave(t, 2.8, i * 0.2);
        fill(
          c,
          poly([
            [rx - 5, GROUND + 20],
            [rx + 5, GROUND + 20],
            [rx + sw, GROUND - 140 - i * 22],
          ]),
          shade(I.leaf, 0.7),
        );
        fill(c, ellipse(rx + sw, GROUND - 150 - i * 22, 9, 24), I.furniture);
      }
    };
    const flamingo = (c, x, y, t, s = 1, wing = 0) => {
      const pink = P.accents.rose,
        bob = 4 * wave(t, 2.2);
      c.save();
      c.translate(x, y + bob * 0.3);
      c.scale(s, s);
      c.lineCap = 'round';
      c.strokeStyle = shade(pink, 0.8);
      c.lineWidth = 9;
      c.beginPath(); // standing leg
      c.moveTo(0, -200);
      c.lineTo(4, 0);
      c.stroke();
      c.beginPath(); // folded leg
      c.moveTo(6, -200);
      c.lineTo(46, -150);
      c.lineTo(4, -128);
      c.stroke();
      fill(c, ellipse(10, -236 + bob, 88, 50, -0.15), pink);
      // wing (lifts to wave)
      c.save();
      c.translate(-20, -250 + bob);
      c.rotate(-wing * (0.9 + 0.25 * wave(t, 0.6)));
      fill(c, ellipse(40, 0, 66, 30, -0.1), shade(pink, 0.86));
      c.restore();
      // S-neck and head
      c.strokeStyle = pink;
      c.lineWidth = 22;
      c.beginPath();
      c.moveTo(70, -250 + bob);
      c.bezierCurveTo(140, -300, 40, -340, 90, -420 + bob);
      c.stroke();
      fill(c, circle(96, -428 + bob, 26), pink);
      fill(
        c,
        poly([
          [112, -436 + bob],
          [158, -418 + bob],
          [150, -398 + bob],
          [112, -414 + bob],
        ]),
        P.text,
      );
      fill(
        c,
        poly([
          [142, -420 + bob],
          [158, -418 + bob],
          [150, -398 + bob],
          [140, -404 + bob],
        ]),
        I.shadow,
      );
      fill(c, circle(100, -436 + bob, 5), I.shadow);
      c.restore();
    };
    const bird = (c, x, y, t, s = 1, waveK = 0) => {
      c.save();
      c.translate(x, y + 6 * wave(t, 1.4));
      c.scale(s, s);
      fill(c, ellipse(0, 0, 42, 36), P.accents.sky);
      fill(c, ellipse(6, 10, 26, 20), shade(P.accents.sky, 1.35));
      c.save();
      c.translate(-14, -6);
      c.rotate(-0.4 - (0.6 + 0.5 * wave(t, 0.35)) * (0.4 + waveK));
      fill(c, ellipse(-22, 0, 30, 14), shade(P.accents.sky, 0.78));
      c.restore();
      fill(c, circle(16, -12, 6), I.shadow);
      fill(
        c,
        poly([
          [34, -8],
          [56, -2],
          [34, 6],
        ]),
        P.accents.sun,
      );
      c.restore();
    };

    // ---------- the child ----------
    const child = (c, p, t, walkK, cheer) => {
      const ph = (camAt(t) / 180) * Math.PI; // steps follow the ground
      const bob = walkK * -12 * Math.abs(Math.sin(ph));
      const x = CX + p.dx,
        py = GROUND - 230 + p.py + bob;
      const neckY = py - 178,
        shY = neckY + 20;
      const lean = walkK * 7 * Math.sin(ph);
      const shoulder = (sgn) => [x + lean + sgn * 58, shY];
      const step = (side, pt, j) => {
        if (!walkK) return pt;
        const lift = Math.max(0, Math.sin(ph + (side === 'L' ? 0 : Math.PI))) * walkK;
        return [pt[0] + (j ? 6 : 10) * lift * (side === 'L' ? 1 : -1), pt[1] - (j ? 58 : 34) * lift];
      };
      const swing = (side, pt, j) =>
        walkK
          ? [
              pt[0] + (j ? 22 : 9) * walkK * Math.sin(ph + (side === 'L' ? Math.PI : 0)),
              pt[1] - (j ? 10 : 0) * walkK * Math.abs(Math.sin(ph)),
            ]
          : pt;
      contact(c, x, 110 - p.py * 0.2);
      // legs
      for (const [side, sgn] of [
        ['L', -1],
        ['R', 1],
      ]) {
        const leg = p['l' + side];
        const hip = [x + sgn * 36, py];
        const knee = step(side, [x + leg[0][0], py + leg[0][1]], 0),
          foot = step(side, [x + leg[1][0], py + leg[1][1]], 1);
        limb(c, hip, knee, 52, shade(C.skin, 0.96), 0.86, 0);
        limb(c, knee, foot, 48, C.skin, 0.86, 0);
        fill(c, ellipse(foot[0] + sgn * 10, foot[1] + 6, 34, 18), C.shoe);
        fill(c, ellipse(foot[0] + sgn * 4, foot[1] + 1, 18, 7), shade(C.shoe, 1.3));
      }
      // shorts and shirt
      fill(c, rrect(x - 76 + lean * 0.5, py - 46, 152, 98, [10, 10, 30, 30]), C.shorts);
      fill(c, rrect(x - 4 + lean * 0.5, py + 8, 8, 44, 4), shade(C.shorts, 0.75));
      fill(c, rrect(x - 70 + lean, neckY, 140, 168, [52, 52, 20, 20]), C.shirt);
      fill(c, rrect(x - 70 + lean, neckY + 120, 140, 48, [0, 0, 20, 20]), shade(C.shirt, 0.9));
      fill(c, circle(x + lean, neckY + 70, 16), shade(C.shirt, 1.25)); // a little star badge
      fill(c, KIT.star(x + lean, neckY + 70, 14, 6), shade(C.shirt, 0.75));
      // head
      const hx = x + lean * 1.4,
        hy = neckY - 88;
      fill(c, rrect(hx - 18, neckY - 20, 36, 34, 10), shade(C.skin, 0.85));
      fill(c, circle(hx - 92, hy - 20, 40), C.hair); // puffs
      fill(c, circle(hx + 92, hy - 20, 40), C.hair);
      fill(c, circle(hx - 70, hy - 10, 12), P.accents.rose);
      fill(c, circle(hx + 70, hy - 10, 12), P.accents.rose);
      fill(c, circle(hx, hy, 84), C.skin);
      fill(
        c,
        KIT.path((q) => q.ellipse(hx, hy - 34, 92, 62, 0, Math.PI, 0)),
        C.hair,
      );
      fill(
        c,
        blob([
          [hx - 86, hy - 30],
          [hx - 30, hy - 60],
          [hx + 20, hy - 40],
          [hx + 86, hy - 30],
          [hx + 40, hy - 90],
          [hx - 40, hy - 92],
        ]),
        C.hair,
      );
      fill(c, ellipse(hx - 30, hy - 66, 24, 8, -0.3), rgba('#ffffff', 0.14));
      const blink = cycle(t, 3.3, 0.2) < 0.05 ? 0.15 : 1;
      fill(c, ellipse(hx - 30, hy + 8, 9, 12 * blink), I.shadow);
      fill(c, ellipse(hx + 30, hy + 8, 9, 12 * blink), I.shadow);
      if (blink === 1) {
        fill(c, circle(hx - 27, hy + 3, 3), P.text);
        fill(c, circle(hx + 33, hy + 3, 3), P.text);
      }
      fill(c, ellipse(hx - 52, hy + 32, 15, 9), rgba(P.accents.rose, 0.55));
      fill(c, ellipse(hx + 52, hy + 32, 15, 9), rgba(P.accents.rose, 0.55));
      // smile, opening wide when cheering
      fill(
        c,
        KIT.path((q) => q.ellipse(hx, hy + 34, 24, 8 + 12 * cheer, 0, 0, Math.PI)),
        shade(P.accents.rose, 0.55),
      );
      // arms (in front of the head, so raised arms stay readable)
      for (const [side, sgn] of [
        ['L', -1],
        ['R', 1],
      ]) {
        const arm = p['a' + side],
          s = shoulder(sgn);
        let e = swing(side, [s[0] + 1.18 * arm[0][0], s[1] + 1.18 * arm[0][1]], 0),
          h = swing(side, [s[0] + 1.18 * arm[1][0], s[1] + 1.18 * arm[1][1]], 1);
        if (side === 'R' && p.waveK)
          h = [h[0] + 40 * p.waveK * wave(t, 0.7), h[1] + 6 * p.waveK * Math.abs(wave(t, 0.7))];
        limb(c, s, e, 40, C.skin, 0.86, 0);
        fill(c, KIT.capsule(s, [mix(s[0], e[0], 0.42), mix(s[1], e[1], 0.42)], 46), C.shirt); // short sleeve
        limb(c, e, h, 36, C.skin, 0.86, 0);
        fill(c, circle(h[0], h[1], 22), shade(C.skin, 1.04));
      }
      return [hx, hy];
    };

    const chip = (c, s, y, k, dot = P.channels.kids) => {
      if (k <= 0.01) return;
      const w = textWidth(c, s, 46, 800) + 112;
      c.save();
      c.globalAlpha = Math.min(1, k * 1.5);
      c.translate(960, y + 36);
      c.scale(0.8 + 0.2 * backOut(k, 1.6), 0.8 + 0.2 * backOut(k, 1.6));
      fill(c, rrect(-w / 2 + 10, -26, w, 84, 42), rgba(I.shadow, 0.5));
      fill(c, rrect(-w / 2, -36, w, 84, 42), P.surface);
      fill(c, circle(-w / 2 + 44, 6, 12), dot);
      text(c, s, -w / 2 + 70, 22, 46, P.text, 800, 'left');
      c.restore();
    };

    return (c, t) => {
      const cam = camAt(t),
        walkK = walking(t),
        p = poseAt(t);
      sky(c, t);
      hills(c, cam);
      ground(c, cam, t);
      tufts(c, cam, t, false);
      // scenes along the path (world x = i * STATION, friend stands right of the child)
      const at = (i, dx) => CX + dx + i * STATION - cam;
      const treeK = ramp(t, T[0] - 3.9, T[0] - 3.2) - ramp(t, T[0] + 0.6, T[0] + 1.2);
      tree(c, at(0, 560), t, treeK);
      // mouse scurries in to its mushroom, sits up while the child crouches
      const mx = at(1, 470) + 700 * (1 - ease(ramp(t, T[1] - 5.6, T[1] - 4.0)));
      fill(c, rrect(at(1, 640) - 16, GROUND - 120, 32, 120, 10), P.text);
      fill(
        c,
        KIT.path((q) => q.ellipse(at(1, 640), GROUND - 118, 90, 64, 0, Math.PI, 0)),
        P.accents.rose,
      );
      [
        [-40, -150],
        [10, -170],
        [48, -140],
      ].forEach(([a, b]) => fill(c, circle(at(1, 640) + a, GROUND + b, 11), P.text));
      mouse(c, mx, t, ramp(t, T[1] - 3.9, T[1] - 3.2) - ramp(t, T[1] + 0.6, T[1] + 1.2));
      pond(c, at(2, 560), t);
      flamingo(c, at(2, 520), GROUND + 24, t);
      // the friends gather in the clearing and wave back
      const wk = ramp(t, T[3] - 3.6, T[3] - 3.0);
      mouse(c, at(3, 360), t, 1, 0.9, wk);
      flamingo(c, at(3, 640), GROUND + 6, t, 0.78, wk);
      bird(c, at(3, 470) + 60 * wave(t, 6), 360 + 20 * wave(t, 3), t, 1.1, wk);
      bird(c, at(3, 820) - 50 * wave(t, 7, 0.4), 290 + 16 * wave(t, 2.6, 0.5), t, 0.8, wk);

      const cheer = Math.max(
        ...T.map((g) => KIT.pulse(t, g + 0.6, 0.2, 1.0, 0.4)),
        ramp(t, T[3] + 0.6, T[3] + 1.0),
      );
      const pw = { ...p, waveK: ramp(t, T[3] - 3.2, T[3] - 2.8) };
      const [hx, hy] = child(c, pw, t, walkK, cheer);
      meadow(c, cam, t);
      fireflies(c, t);

      // celebrations after each step
      T.forEach((g, i) =>
        burst(
          c,
          t,
          g + 0.6,
          hx,
          hy + 120,
          [P.accents.sun, P.accents.rose, P.accents.sky, P.accents.lagoon],
          20 + i,
          16,
          320,
        ),
      );
      T.forEach((g) => chip(c, 'Great job!', 132, KIT.pulse(t, g + 0.85, 0.3, 1.0, 0.3), P.accents.rose));

      // title, step prompts (the gate labels), the end
      const tk = KIT.pulse(t, 0.2, 0.6, 1.6, 0.5);
      if (tk > 0) {
        c.globalAlpha = tk;
        text(c, track.title, 960, 160 + 20 * (1 - tk), 104, P.text, 800);
        text(c, 'Walk with me and copy what you see!', 960, 224 + 20 * (1 - tk), 40, P.textMuted, 600);
        c.globalAlpha = 1;
      }
      order.forEach((id, i) => chip(c, G[id].label + '!', 132, KIT.pulse(t, T[i] - 3.9, 0.4, 4.05, 0.25)));
      const ek = ramp(t, T[3] + 1.6, T[3] + 2.3);
      if (ek > 0) {
        c.save();
        c.globalAlpha = ek;
        text(c, 'The End', 1380, 250, 120 * (0.85 + 0.15 * backOut(ek)), P.text, 800);
        text(c, 'Bye-bye, forest friends!', 1380, 322, 42, P.textMuted, 600);
        c.restore();
      }

      KIT.fade(c, t, dur);
      label(c, 'Animated story', P.channels.kids);
    };
  };
})();
