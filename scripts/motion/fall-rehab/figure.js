// The teacher for the fall-prevention lessons: an older woman in side view, facing right, hands on a chair back.
// Kinematics are ported from scripts/make-animated-lesson.py (same lengths, same joint logic) so the timed moves the
// gates check stay the same; only the drawing is new (flat shapes, no outlines, one light from the upper left).
(() => {
  const { form, fill, rrect, circle, ellipse, poly, blob, limb, shade, rgba, mix } = K;
  const F = (window.FIGURE = {});
  const S = (F.S = 660); // figure height in px
  const L = { foot: 0.15 * S, shin: 0.245 * S, thigh: 0.245 * S, torso: 0.3 * S, neck: 0.045 * S, head: 0.074 * S, upper: 0.17 * S, fore: 0.155 * S };
  const ANKLE_H = 0.045 * S;
  const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const rad = (d) => (d * Math.PI) / 180;

  // Stance leg: the ball of the foot stays on the floor; the heel lifts by rotating about it.
  function legFromGround(heelX, heelDeg) {
    const FL = ROOM.FLOOR, ball = [heelX + L.foot * 0.72, FL], toe = [heelX + L.foot, FL], a = rad(heelDeg);
    const rot = (vx, vy) => [ball[0] + vx * Math.cos(a) - vy * Math.sin(a), ball[1] + vx * Math.sin(a) + vy * Math.cos(a)];
    const ankle = rot(heelX + L.foot * 0.18 - ball[0], -ANKLE_H);
    const heel = rot(heelX - ball[0], 0);
    const knee = [ankle[0] - 0.01 * S, ankle[1] - L.shin];
    const hip = [knee[0] + 0.005 * S, knee[1] - L.thigh];
    return { heel, ball, toe, ankle, knee, hip, a, ground: true };
  }
  // Swing leg from the hip: thigh angle forward of vertical, knee bend bringing the shin back.
  function legFromHip(hip, thighDeg, kneeDeg) {
    const t = rad(thighDeg), knee = [hip[0] + L.thigh * Math.sin(t), hip[1] + L.thigh * Math.cos(t)];
    const s = t - rad(kneeDeg), ankle = [knee[0] + L.shin * Math.sin(s), knee[1] + L.shin * Math.cos(s)];
    const sd = [Math.sin(s), Math.cos(s)], fw = [Math.cos(s), -Math.sin(s)];
    const toe = add(add(ankle, fw, 0.82 * L.foot), sd, ANKLE_H * 0.6), heel = add(add(ankle, fw, -0.18 * L.foot), sd, ANKLE_H * 0.6);
    return { heel, ball: toe, toe, ankle, knee, hip, a: 0, ground: false };
  }
  // Two-link arm reaching `target`; the elbow bends down and back.
  function ik(sh, target, a, b) {
    const dx = target[0] - sh[0], dy = target[1] - sh[1], d = Math.min(Math.hypot(dx, dy), a + b - 0.5), base = Math.atan2(dy, dx);
    const ang = base + Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
    return [[sh[0] + a * Math.cos(ang), sh[1] + a * Math.sin(ang)], [sh[0] + d * Math.cos(base), sh[1] + d * Math.sin(base)]];
  }

  // o: { heelX, heel (deg, both feet), farLeg/nearLeg: [thighDeg, kneeDeg] (lifts that leg), lean (deg), rail: [x,y] }
  // Facing right, the far leg is her right leg and the near leg her left.
  F.pose = (o) => {
    let far = legFromGround(o.heelX - 0.012 * S, o.heel || 0), near = legFromGround(o.heelX + 0.012 * S, o.heel || 0);
    let hip = [(far.hip[0] + near.hip[0]) / 2, Math.min(far.hip[1], near.hip[1])];
    if (o.farLeg) far = legFromHip([hip[0] - 0.012 * S, hip[1]], ...o.farLeg);
    if (o.nearLeg) near = legFromHip([hip[0] + 0.012 * S, hip[1]], ...o.nearLeg);
    const a = rad(o.lean ?? 4), up = [Math.sin(a), -Math.cos(a)], fwd = [Math.cos(a), Math.sin(a)];
    const shoulder = add(hip, up, L.torso), neckTop = add(add(shoulder, up, L.neck), fwd, 0.012 * S);
    const head = add(add(neckTop, up, L.head * 0.62), fwd, 0.016 * S + (o.chin || 0));
    const shN = add(add(shoulder, fwd, 0.004 * S), up, -0.035 * S), shF = add(shN, fwd, -0.03 * S);
    const rail = o.rail;
    const [elF, handF] = ik(shF, [rail[0] - 0.006 * S, rail[1] + 0.006 * S], L.upper, L.fore);
    const [elN, handN] = ik(shN, [rail[0] + 0.004 * S, rail[1] + 0.012 * S], L.upper, L.fore);
    return { far, near, hip, up, fwd, shoulder, neckTop, head, shN, shF, elF, handF, elN, handN };
  };

  // ---------- parts ----------
  function shoe(c, I, leg, k) {
    // Foot frame from the heel along the sole. On a stance leg the part behind the ball turns with the heel lift
    // while the toe stays flat on the floor.
    const flat = [1, 0], upF = [0, -1];
    const map = (s, h) => {
      if (leg.ground && s <= 0.72) {
        const a = leg.a, dir = [Math.cos(a), Math.sin(a)], up = [Math.sin(a), -Math.cos(a)];
        return add(add(leg.ball, dir, (s - 0.72) * L.foot), up, h * L.foot);
      }
      if (leg.ground) return add(add(leg.ball, flat, (s - 0.72) * L.foot), upF, h * L.foot);
      const v = [leg.toe[0] - leg.heel[0], leg.toe[1] - leg.heel[1]], n = Math.hypot(...v), d = [v[0] / n, v[1] / n];
      return add(add(leg.heel, d, s * L.foot), [d[1], -d[0]], h * L.foot);
    };
    const white = shade(I.clothes[6], k), sole = shade(I.clothes[6], 0.78 * k);
    const upper = [[-0.06, 0.1], [-0.07, 0.36], [0.06, 0.46], [0.3, 0.46], [0.5, 0.38], [0.8, 0.28], [1.02, 0.16], [1.04, 0.04], [0.5, 0.02]];
    form(c, blob(upper.map((p) => map(...p))), white, { shadow: shade(I.clothes[6], 0.82 * k), v: [6, 7], w: [3, 3] });
    fill(c, poly([map(-0.07, 0.0), map(1.06, 0.0), map(1.06, 0.1), map(-0.07, 0.12)]), sole);
    fill(c, circle(...map(0.4, 0.36), 4.5), shade(I.clothes[0], k)); // laces
    fill(c, circle(...map(0.54, 0.31), 4.5), shade(I.clothes[0], k));
  }
  function leg(c, I, g, k, sock) {
    const pants = shade(I.pants[1], k), hem = K.lerp2(g.knee, g.ankle, 0.66);
    fill(c, limb(hem, g.ankle, 0.054 * S, 0.056 * S), shade(sock, k)); // a bright sock makes the heel easy to follow
    form(c, limb(g.knee, hem, 0.084 * S, 0.074 * S), pants, { shadow: shade(I.pants[1], 0.8 * k) });
    form(c, limb(g.hip, g.knee, 0.112 * S, 0.088 * S), pants, { shadow: shade(I.pants[1], 0.8 * k) });
    shoe(c, I, g, k);
  }
  function arm(c, P, I, sh, el, hand, k) {
    const knit = shade(P.channel, k);
    form(c, limb(sh, el, 0.086 * S, 0.07 * S), knit, { shadow: shade(P.channel, 0.78 * k) });
    const cuff = K.lerp2(el, hand, 0.82);
    form(c, limb(el, cuff, 0.07 * S, 0.06 * S), knit, { shadow: shade(P.channel, 0.78 * k) });
    fill(c, limb(K.lerp2(el, hand, 0.74), cuff, 0.066 * S, 0.066 * S), shade(P.channel, 1.18 * k)); // ribbed cuff
    // hand wrapped over the rail: palm blob plus a thumb along the near side
    const skin = shade(I.skinTone, k), a = Math.atan2(hand[1] - el[1], hand[0] - el[0]);
    fill(c, limb(cuff, hand, 0.04 * S, 0.042 * S), skin);
    form(c, ellipse(hand[0] + 0.012 * S, hand[1] + 0.006 * S, 0.048 * S, 0.034 * S, a * 0.4), skin, { shadow: shade(I.skinTone, 0.82 * k), v: [5, 5], w: [2, 2] });
    fill(c, limb([hand[0] + 0.02 * S, hand[1] - 0.012 * S], [hand[0] + 0.05 * S, hand[1] + 0.028 * S], 0.024 * S, 0.02 * S), shade(I.skinTone, 0.9 * k)); // fingers over the far side
  }
  function torso(c, P, I, p) {
    const pt = (s, w) => add(add(p.hip, p.up, s * L.torso), p.fwd, w * S);
    // trousers seat
    form(c, ellipse(...add(p.hip, p.fwd, -0.004 * S), 0.098 * S, 0.07 * S, Math.atan2(p.up[1], p.up[0]) + Math.PI / 2), I.pants[1], { shadow: shade(I.pants[1], 0.8) });
    // cardigan body (falls a little below the hip)
    const body = blob([pt(-0.16, -0.094), pt(0.1, -0.088), pt(0.45, -0.086), pt(0.78, -0.09), pt(0.98, -0.062), pt(1.03, 0.0), pt(0.95, 0.07), pt(0.72, 0.1), pt(0.42, 0.102), pt(0.1, 0.1), pt(-0.16, 0.092), pt(-0.2, 0.0)]);
    form(c, body, P.channel, { shadow: shade(P.channel, 0.78), v: [12, 12], w: [5, 5] });
    // shirt collar in the V of the cardigan, placket with buttons, a pocket
    fill(c, poly([pt(0.98, 0.0), pt(0.99, 0.064), pt(0.72, 0.09)]), I.clothes[6]);
    fill(c, limb(pt(0.72, 0.088), pt(-0.14, 0.086), 0.012 * S, 0.012 * S), shade(P.channel, 0.85));
    for (const s of [0.6, 0.38, 0.16]) fill(c, circle(...pt(s, 0.08), 0.011 * S), I.clothes[6]);
    fill(c, rrect(...pt(0.12, -0.012), 0.05 * S, 0.044 * S, 8), shade(P.channel, 0.9));
  }
  function head(c, P, I, p) {
    const [hx, hy] = p.head, r = L.head, skin = I.skinTone, hair = I.hairGrey;
    form(c, limb(p.shoulder, p.neckTop, 0.056 * S, 0.05 * S), shade(skin, 0.86), { hi: null });
    // skull + jaw + nose
    form(c, blob([[hx - r * 0.95, hy + r * 0.05], [hx - r * 0.6, hy - r * 0.85], [hx + r * 0.3, hy - r * 0.98], [hx + r * 0.92, hy - r * 0.35], [hx + r * 1.12, hy + r * 0.12], [hx + r * 0.98, hy + r * 0.3], [hx + r * 0.9, hy + r * 0.72], [hx + r * 0.45, hy + r * 1.02], [hx - r * 0.3, hy + r * 0.85]]), skin, { shadow: shade(skin, 0.86), v: [7, 8], w: [3, 3] });
    fill(c, ellipse(hx + r * 0.62, hy + r * 0.42, r * 0.2, r * 0.13), rgba(P.accents.rose, 0.35)); // cheek
    // eye with a soft lid, brow, smile and laugh lines
    fill(c, ellipse(hx + r * 0.56, hy - r * 0.06, r * 0.11, r * 0.13), I.shadow);
    fill(c, circle(hx + r * 0.6, hy - r * 0.1, r * 0.035), rgba('#ffffff', 0.85));
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = shade(skin, 0.7);
    c.lineWidth = r * 0.06;
    c.beginPath();
    c.arc(hx + r * 0.56, hy - r * 0.02, r * 0.19, Math.PI * 1.15, Math.PI * 1.75);
    c.stroke();
    c.strokeStyle = I.shadow;
    c.lineWidth = r * 0.07;
    c.beginPath();
    c.arc(hx + r * 0.74, hy + r * 0.44, r * 0.2, Math.PI * 0.3, Math.PI * 0.8);
    c.stroke();
    c.strokeStyle = shade(skin, 0.75);
    c.lineWidth = r * 0.04;
    c.beginPath();
    c.arc(hx + r * 0.3, hy - r * 0.04, r * 0.16, Math.PI * 0.7, Math.PI * 1.2);
    c.stroke();
    c.restore();
    fill(c, limb([hx + r * 0.42, hy - r * 0.36], [hx + r * 0.78, hy - r * 0.32], r * 0.1, r * 0.08), shade(hair, 0.8));
    // ear
    form(c, ellipse(hx - r * 0.12, hy + r * 0.12, r * 0.17, r * 0.24), shade(skin, 0.95), { v: [3, 3], w: [1, 1] });
    // hair: cap over the back and top, a bun, and a few strand groups
    const cap = blob([[hx - r * 1.05, hy + r * 0.35], [hx - r * 1.08, hy - r * 0.45], [hx - r * 0.55, hy - r * 1.04], [hx + r * 0.25, hy - r * 1.12], [hx + r * 0.85, hy - r * 0.62], [hx + r * 0.5, hy - r * 0.6], [hx - r * 0.02, hy - r * 0.42], [hx - r * 0.3, hy - r * 0.05], [hx - r * 0.55, hy + r * 0.35]]);
    form(c, circle(hx - r * 0.95, hy - r * 0.62, r * 0.4), hair, { shadow: shade(hair, 0.8), v: [6, 6], w: [2, 2] });
    form(c, cap, hair, { shadow: shade(hair, 0.8), v: [7, 8], w: [3, 3] });
    c.save();
    c.clip(cap);
    c.strokeStyle = shade(hair, 0.78);
    c.lineWidth = r * 0.06;
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(hx + r * 0.9, hy + r * 0.6, r * (1.25 + i * 0.28), Math.PI * 1.08, Math.PI * 1.42);
      c.stroke();
    }
    c.restore();
  }

  // Far arm (behind the chair) — drawn before the chair.
  F.drawFar = (c, P, I, p) => arm(c, P, I, p.shF, p.elF, p.handF, 0.74);
  // Everything else, in depth order: legs (the cardigan hem falls over the thighs), torso, head, near arm.
  F.drawMain = (c, P, I, p) => {
    leg(c, I, p.far, 0.74, P.accents.sun);
    leg(c, I, p.near, 1, P.accents.sun);
    torso(c, P, I, p);
    head(c, P, I, p);
    arm(c, P, I, p.shN, p.elN, p.handN, 1);
  };
  F.mix = mix;
})();
