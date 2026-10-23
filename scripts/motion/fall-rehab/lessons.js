// Timelines: each lesson's moves land on the gate times in content/lessons/<id>/track.istep. Segments a gate loops
// (rewindTo .. t) start and end on the same pose, with ambient motion periodic in the loop length.
(() => {
  const { ramp, pulse, wave, mix, fill, ellipse, rgba, poly, shade } = K;
  const LESSONS = (window.LESSONS = {});
  const ill = (P, channel) => ({ ...P.illustration, skinTone: P.skin[2], hairGrey: P.illustration.hair[2] });

  // Figure + chair go through an offscreen layer so they can cast one flat long shadow down-right (no blur).
  const mk = () => {
    const cv = document.createElement('canvas');
    cv.width = 1280;
    cv.height = 720;
    return [cv, cv.getContext('2d')];
  };
  const [off, oc] = mk(), [tint, tc] = mk();
  function withShadow(c, I, cam, draw) {
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.clearRect(0, 0, off.width, off.height);
    oc.setTransform(c.getTransform());
    oc.translate(cam, 0);
    draw(oc);
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalCompositeOperation = 'copy';
    tc.drawImage(off, 0, 0);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = I.longShadow;
    tc.fillRect(0, 0, tint.width, tint.height);
    tc.globalCompositeOperation = 'source-over';
    const F = ROOM.FLOOR, kx = 0.42, ky = 0.2;
    c.save();
    c.transform(1, 0, -kx, -ky, kx * F, F * (1 + ky));
    c.drawImage(tint, 0, 0, K.W, K.H);
    c.restore();
    c.drawImage(off, 0, 0, K.W, K.H);
  }

  // One living-room frame: room, figure at the chair, ambient motion, then cue chips and the label.
  const HEEL_X = 800;
  function livingRoom(c, P, t, dur, pose, after) {
    const I = ill(P);
    P = { ...P, channel: P.channels.fall_prevention };
    const cam = 8 * wave(t, 10); // slow parallax drift, 10 s period
    c.save();
    c.translate(880, 700); // frame the figure a little closer
    c.scale(1.15, 1.15);
    c.translate(-880, -700);
    c.save();
    c.translate(cam * 0.4, 0);
    ROOM.back(c, P, I, t);
    c.restore();
    ROOM.floor(c, P, I, t, cam);
    ROOM.motes(c, P, I, t);
    c.save();
    c.translate(cam * 0.7, 0);
    ROOM.plant(c, P, I, t, 470);
    c.restore();
    fill(c, ellipse(HEEL_X + 60 + cam, ROOM.FLOOR + 6, 150, 16), rgba(I.shadow, 0.4));
    const chairX = HEEL_X + 0.03 * FIGURE.S + 112;
    withShadow(c, I, cam, (g) => {
      const fig = FIGURE.pose({ ...pose, heelX: HEEL_X, rail: [chairX, ROOM.FLOOR - 0.6 * FIGURE.S - 22] });
      FIGURE.drawFar(g, P, I, fig);
      ROOM.chair(g, P, I, chairX, FIGURE.S);
      FIGURE.drawMain(g, P, I, fig);
      if (after) after(g, fig, I, P);
    });
    c.restore();
    return { I, P, cam };
  }
  const CHIP_X = 960, CHIP_Y = 48;

  LESSONS['fall-heel-raise-v1'] = {
    draw(c, P0, t) {
      const dur = 48;
      // raises loop 12..22: five 2 s reps, each rise 0.8 s, top 0.3 s, lower 0.8 s, rest 0.1 s (flat at both ends)
      let lift = 0;
      if (t >= 12 && t < 22) {
        const p = (t - 12) % 2;
        lift = ramp(p, 0, 0.8) - ramp(p, 1.1, 1.9);
      }
      lift = Math.max(lift, pulse(t, 30.8, 1.2, 5.2, 1.4)); // on the toes by 32 s, held to 37.2 s (gate at 36)
      const tall = ramp(t, 4.2, 6.8); // gate t=8: standing tall
      const pose = { heel: 30 * lift, lean: mix(9, 2.5, tall), chin: mix(-2, 2, tall) };
      const { P } = livingRoom(c, P0, t, dur, pose, (g, fig, I, P) => {
        // an upward chevron by the heels while they lift
        const a = Math.max(lift, 0) * (t >= 12 ? 1 : 0);
        if (a > 0.02) {
          const [hx, hy] = fig.near.heel, y = hy - 40 - 30 * a;
          g.save();
          g.globalAlpha = a;
          fill(g, poly([[hx - 70, y + 18], [hx - 50, y - 4], [hx - 30, y + 18], [hx - 38, y + 24], [hx - 50, y + 12], [hx - 62, y + 24]]), P.channel);
          g.restore();
        }
      });
      K.fade(c, P, t, dur);
      K.chip(c, P, 'Hands on the chair', CHIP_X, CHIP_Y, pulse(t, 0.6, 0.4, 3.4, 0.4), P.channel);
      K.chip(c, P, 'Stand tall', CHIP_X, CHIP_Y, pulse(t, 4.8, 0.4, 6.4, 0.4), P.channel);
      if (t >= 12 && t < 22) {
        const n = Math.floor((t - 12) / 2) + 1, a = Math.min(ramp(t, 12, 12.3), 1 - ramp(t, 21.7, 22));
        K.chip(c, P, `Raise ${n} of 5`, CHIP_X, CHIP_Y, a, P.channel);
      }
      K.chip(c, P, 'Heels down, rest', CHIP_X, CHIP_Y, pulse(t, 22.4, 0.4, 7.4, 0.4), P.channel);
      K.chip(c, P, 'Rise and hold', CHIP_X, CHIP_Y, pulse(t, 30.6, 0.4, 6.8, 0.4), P.channel);
      K.chip(c, P, 'Lower slowly', CHIP_X, CHIP_Y, pulse(t, 38.0, 0.3, 2.2, 0.4), P.channel);
      K.label(c, P, P.channel);
    },
  };

  LESSONS['fall-single-leg-stand-v1'] = {
    draw(c, P0, t) {
      const dur = 40;
      const r = pulse(t, 9.0, 1.2, 6.2, 1.2); // right foot up 10.2..16.4 (gate t=12, hold 5 s), down with the narration
      const l = pulse(t, 23.0, 1.2, 6.2, 1.2); // left foot up 24.2..30.4 (gate t=26, hold 5 s)
      // facing screen-right she shows us her right side: the near leg is her right leg, the far leg her left
      const pose = { lean: 3, chin: 2 };
      if (r > 0.001) pose.nearLeg = [12 * r, 60 * r];
      if (l > 0.001) pose.farLeg = [12 * l, 60 * l];
      const { P } = livingRoom(c, P0, t, dur, pose, (g, fig, I, P) => {
        // a channel-coloured spot under the lifted foot ties it to the chip
        for (const [k, leg] of [[r, fig.near], [l, fig.far]]) {
          if (k < 0.02) continue;
          g.save();
          g.globalAlpha = k;
          fill(g, ellipse(leg.ankle[0] + 10, ROOM.FLOOR + 4, 70, 12), rgba(P.channel, 0.55));
          g.restore();
        }
      });
      K.fade(c, P, t, dur);
      K.chip(c, P, 'Hands on the chair', CHIP_X, CHIP_Y, pulse(t, 0.6, 0.4, 7.4, 0.4), P.channel);
      K.chip(c, P, 'Right foot', CHIP_X, CHIP_Y, pulse(t, 8.8, 0.4, 8.4, 0.4), P.channel);
      K.chip(c, P, 'Left foot', CHIP_X, CHIP_Y, pulse(t, 22.8, 0.4, 8.4, 0.4), P.channel);
      K.label(c, P, P.channel);
    },
  };

  LESSONS['rehab-hand-open-close-v1'] = {
    draw(c, P0, t) {
      const dur = 20, I = ill(P0), P = { ...P0, channel: P0.channels.stroke_rehab };
      let close = 0;
      const reps = t >= 4 && t < dur - 2;
      if (reps) {
        const p = (t - 4) % 2; // open 0..0.5, close 0.5..1.0, soft fist 1.0..1.4, open 1.4..1.9 (starts and ends open)
        close = ramp(p, 0.5, 1.0) - ramp(p, 1.4, 1.9);
      } else if (t < 4) close = 0.35 * (1 - ramp(t, 1.0, 3.0)); // relaxed hand opening up
      HAND.room(c, P, I, t);
      HAND.table(c, P, I, t);
      HAND.draw(c, P, I, 960, 530, 236, close);
      K.fade(c, P, t, dur);
      // chip follows the rep phase, so 4 s and 8 s both read "Open wide"
      const p = t >= 4 ? (t - 4) % 2 : 0;
      const chipA = Math.min(ramp(t, 3.6, 4.0), 1 - ramp(t, dur - 2.4, dur - 2));
      K.chip(c, P, p >= 0.55 && p < 1.45 ? 'Soft fist' : 'Open wide', CHIP_X, CHIP_Y, chipA, P.channel);
      K.label(c, P, P.channel);
    },
  };
})();
