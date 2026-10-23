// A right hand as a small 3D model, drawn flat (outline-free, value-separated) after an orthographic projection.
// Hand coordinates (palm units): x toward the thumb side, y toward the fingertips, z out of the palm. With yaw 0 the
// palm faces the viewer, so a right hand shows its thumb on the viewer's right. Positive yaw turns the palm toward
// the viewer's right (used for C, so the curve reads as the letter).
// Each finger is three bones (MCP, PIP, DIP flexion in degrees) plus a sideways spread; the thumb is three bones
// given as (azimuth from +y toward +x, elevation toward +z). Shapes interpolate number by number.
(() => {
  const { fill, limb, shade, mix, poly } = KIT;
  const D = Math.PI / 180;
  const HAND = (window.HAND = {});

  // index, middle, ring, little: base x, base y (knuckle arch), bone lengths, width
  const FINGERS = [
    { x: 0.35, y: 0.5, len: [0.46, 0.28, 0.22], w: 0.235 },
    { x: 0.12, y: 0.54, len: [0.5, 0.31, 0.23], w: 0.245 },
    { x: -0.11, y: 0.52, len: [0.47, 0.29, 0.22], w: 0.235 },
    { x: -0.33, y: 0.44, len: [0.37, 0.22, 0.19], w: 0.21 },
  ];
  const THUMB = { root: [0.3, -0.45, -0.02], len: [0.44, 0.31, 0.26], w: [0.36, 0.225, 0.205] };

  const FIST = [80, 105, 70];
  const STRAIGHT = [0, 0, 0];
  // fingers: [index, middle, ring, little] each [mcp, pip, dip]; spread in degrees (+ toward the thumb side)
  HAND.SHAPES = {
    rest: {
      f: [
        [8, 10, 6],
        [8, 12, 6],
        [10, 14, 8],
        [12, 16, 8],
      ],
      spread: [9, 1, -6, -13],
      thumb: [
        [42, 22],
        [48, 12],
        [44, 6],
      ],
      yaw: 10,
    },
    // A: fist, thumb straight up against the side of the index finger
    A: {
      f: [FIST, FIST, FIST, FIST],
      spread: [0, 0, 0, 0],
      thumb: [
        [45, 15],
        [-2, 8],
        [-4, 4],
      ],
      yaw: 12,
    },
    // B: four fingers straight up and together, thumb folded across the palm
    B: {
      f: [STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT],
      spread: [1, 0, -1, -2],
      thumb: [
        [38, 38],
        [-72, 12],
        [-96, 2],
      ],
      yaw: 10,
    },
    // C: fingers and thumb curved like holding a cup, turned so the C opens to the viewer's right
    C: {
      f: [
        [40, 48, 40],
        [40, 48, 40],
        [42, 50, 40],
        [44, 52, 42],
      ],
      spread: [0, 0, 0, -2],
      thumb: [
        [35, 20],
        [20, 70],
        [10, 45],
      ],
      yaw: 68,
    },
    // L: index up, thumb out to the side, other three folded
    L: {
      f: [STRAIGHT, FIST, FIST, FIST],
      spread: [2, 0, 0, 0],
      thumb: [
        [35, 16],
        [80, 6],
        [86, 2],
      ],
      yaw: 10,
    },
    // Y: thumb and little finger out, three middle fingers folded
    Y: {
      f: [FIST, FIST, FIST, STRAIGHT],
      spread: [0, 0, 0, -26],
      thumb: [
        [38, 16],
        [68, 6],
        [74, 2],
      ],
      yaw: 10,
    },
    // I love you: thumb, index and little finger out; middle and ring folded
    ILY: {
      f: [STRAIGHT, FIST, FIST, STRAIGHT],
      spread: [4, 0, 0, -22],
      thumb: [
        [38, 16],
        [72, 6],
        [78, 2],
      ],
      yaw: 10,
    },
  };

  HAND.mixShape = (a, b, k) => ({
    f: a.f.map((fa, i) => fa.map((v, j) => mix(v, b.f[i][j], k))),
    spread: a.spread.map((v, i) => mix(v, b.spread[i], k)),
    thumb: a.thumb.map((ta, i) => ta.map((v, j) => mix(v, b.thumb[i][j], k))),
    yaw: mix(a.yaw, b.yaw, k),
  });

  const add = (p, d, s) => [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s];

  // 3D bones of a shape: [{a, b, w, kind, n}] where n is the palmar normal of the bone (for nails and creases)
  function bones(S) {
    const out = [];
    FINGERS.forEach((F, i) => {
      const s = S.spread[i] * D * (1 - Math.min(1, S.f[i][0] / 60) * 0.8); // curled fingers close up
      const d0 = [Math.sin(s), Math.cos(s), 0];
      let p = [F.x, F.y, 0.02],
        cum = 0;
      F.len.forEach((L, j) => {
        cum += S.f[i][j] * D;
        const dir = [d0[0] * Math.cos(cum), d0[1] * Math.cos(cum), Math.sin(cum)];
        const q = add(p, dir, L);
        out.push({
          a: p,
          b: q,
          w: F.w * (1 - 0.07 * j),
          kind: j === 2 ? 'tip' : 'bone',
          n: [0, -Math.sin(cum), Math.cos(cum)],
          joint: j,
        });
        p = q;
      });
    });
    let p = THUMB.root;
    S.thumb.forEach(([az, el], j) => {
      const dir = [
        Math.sin(az * D) * Math.cos(el * D),
        Math.cos(az * D) * Math.cos(el * D),
        Math.sin(el * D),
      ];
      const q = add(p, dir, THUMB.len[j]);
      out.push({ a: p, b: q, w: THUMB.w[j], kind: j === 0 ? 'thenar' : 'thumb', n: null, joint: j });
      p = q;
    });
    return out;
  }

  // draw shape S with palm centre at (cx, cy), u px per palm unit
  HAND.draw = (c, S, cx, cy, u, P) => {
    const yaw = S.yaw * D,
      cyw = Math.cos(yaw),
      syw = Math.sin(yaw);
    const view = (p) => [p[0] * cyw + p[2] * syw, p[1], -p[0] * syw + p[2] * cyw];
    const scr = (p) => ((p = view(p)), [cx + p[0] * u, cy - p[1] * u]);
    const depth = (p) => view(p)[2];
    const skin = P.skin,
      sleeve = P.sleeve;

    // forearm and sleeve (behind everything)
    const wristTop = [0.02, -0.5, -0.12],
      elbow = [0.06, -3.2, -0.16];
    limb(c, scr(elbow), scr(wristTop), 0.8 * u, shade(skin, 0.9), 0.86, 0);
    const sv = scr([0.03, -1.12, -0.12]);
    const sw = u * (0.98 * Math.abs(cyw) + 0.62 * Math.abs(syw));
    fill(c, KIT.rrect(sv[0] - sw / 2, sv[1], sw, 900, 0.16 * u), sleeve);
    fill(c, KIT.rrect(sv[0] - sw / 2, sv[1], sw, 0.18 * u, 0.09 * u), shade(sleeve, 1.14));

    // palm: a rounded slab; the side face shows when the hand turns
    const front = [
      [-0.38, -0.56],
      [0.34, -0.56],
      [0.48, -0.25],
      [0.5, 0.42],
      [0.35, 0.56],
      [-0.33, 0.5],
      [-0.47, 0.36],
      [-0.47, -0.2],
    ];
    const T = -0.22; // thickness (back of hand)
    const ring = (z) => front.map(([x, y]) => scr([x, y, z]));
    const r = 0.2 * u;
    const round = (pts, col) => {
      const pp = poly(pts);
      c.lineJoin = 'round';
      c.lineWidth = r;
      c.strokeStyle = col;
      c.stroke(pp);
      fill(c, pp, col);
    };
    round(hull([...ring(0), ...ring(T)]), shade(skin, 0.86)); // side / edge tone
    if (cyw > 0.05) {
      round(ring(0), skin);
      // soft light from the upper left on the palm, palm lines that the fingers cover when they fold
      c.save();
      c.clip(poly(ring(0)));
      const g = c.createLinearGradient(...scr([-0.5, 0.5, 0]), ...scr([0.5, -0.5, 0]));
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0.06)');
      c.fillStyle = g;
      c.fillRect(cx - 2 * u, cy - 2 * u, 4 * u, 4 * u);
      c.restore();
      c.lineCap = 'round';
      c.lineWidth = 0.025 * u;
      c.strokeStyle = shade(skin, 0.86, 0.75);
      const crease = (pts) => {
        c.beginPath();
        pts.map((p) => scr([p[0], p[1], 0.005])).forEach((q, i) => (i ? c.lineTo(...q) : c.moveTo(...q)));
        c.stroke();
      };
      crease([
        [-0.42, 0.24],
        [-0.1, 0.2],
        [0.22, 0.27],
        [0.4, 0.33],
      ]);
      crease([
        [-0.4, 0.06],
        [-0.05, 0.02],
        [0.3, 0.12],
      ]);
      crease([
        [0.3, 0.08],
        [0.18, -0.15],
        [0.12, -0.42],
      ]);
    }

    // bones, far to near
    const list = bones(S).map((b) => ({
      ...b,
      d: (depth(b.a) + depth(b.b)) / 2 + (b.kind === 'thenar' ? -0.2 : 0),
    }));
    list.sort((p, q) => p.d - q.d);
    for (const b of list) {
      const A = scr(b.a),
        B = scr(b.b),
        w = b.w * u;
      if (b.kind === 'thenar') {
        // the thumb's base is part of the palm: same tone, no edge
        fill(c, KIT.capsule(A, B, w), cyw > 0.05 ? skin : shade(skin, 0.8));
        continue;
      }
      const lit = 0.94 + 0.1 * KIT.clamp(b.d / 0.6, -1, 1); // nearer is lighter
      limb(c, A, B, w, shade(skin, lit), 0.8, 0.08);
      if (b.n) {
        const facing = -view(b.n)[2]; // > 0: the back of the finger faces us
        if (b.kind === 'tip' && facing > 0.35) {
          // nail near the tip
          const k = KIT.clamp((facing - 0.35) / 0.3);
          const m = [mix(A[0], B[0], 0.62), mix(A[1], B[1], 0.62)];
          const ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
          c.save();
          c.translate(m[0], m[1]);
          c.rotate(ang);
          const L = Math.max(0.07 * u, Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.55);
          fill(c, KIT.rrect(-L / 2, -w * 0.27, L, w * 0.54, w * 0.2), shade(skin, 1.28, 0.95 * k));
          fill(c, KIT.rrect(-L / 2, -w * 0.27, L * 0.4, w * 0.54, w * 0.2), `rgba(255,255,255,${0.25 * k})`);
          c.restore();
        } else if (facing < -0.6 && b.joint > 0) {
          // joint crease across the pad side
          const dx = B[0] - A[0],
            dy = B[1] - A[1],
            L = Math.hypot(dx, dy) || 1;
          const nx = (-dy / L) * w * 0.28,
            ny = (dx / L) * w * 0.28;
          c.lineWidth = 0.02 * u;
          c.lineCap = 'round';
          c.strokeStyle = shade(skin, 0.8, 0.6);
          c.beginPath();
          c.moveTo(A[0] - nx, A[1] - ny);
          c.lineTo(A[0] + nx, A[1] + ny);
          c.stroke();
        }
      }
    }
  };

  // convex hull (monotone chain) of 2D points
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [],
      up = [];
    for (const q of p) {
      while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
      lo.push(q);
    }
    for (const q of p.reverse()) {
      while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
      up.push(q);
    }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
})();
