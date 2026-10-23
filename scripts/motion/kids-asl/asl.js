// Sign-language lessons: one illustrated right hand forms each handshape, timed from the gates in track.istep.
// Each shape is fully formed at least 2.5 s before its gate time and still held 0.6 s after it (the TV pauses at t).
// Every frame says the handshapes are illustrated and not yet reviewed by Deaf signers.
(() => {
  const {
    fill,
    rrect,
    circle,
    text,
    textWidth,
    rgba,
    shade,
    ramp,
    ease,
    backOut,
    wave,
    rng,
    sparkle,
    label,
    glow,
  } = KIT;
  const LABEL = 'Illustrated handshape · not yet reviewed by Deaf signers';
  const SHAPE_OF = (s) =>
    /love you/i.test(s)
      ? 'ILY'
      : s
          .replace(/^(letter|sign)\s*:?\s*/i, '')
          .trim()
          .toUpperCase();

  window.ASL = (track, P) => {
    const dur = track.video.durationSec;
    const gates = track.gates.slice().sort((a, b) => a.t - b.t);
    const iris = P.channels.sign_language;
    const pal = { skin: P.skin[2], sleeve: shade(iris, 0.72) };

    // ---- timeline: [time the shape is fully formed, shape, transition seconds]; card content per gate ----
    const keys = [[0, 'rest', 0]];
    const cards = []; // {from, gate, letters, active}
    gates.forEach((g, gi) => {
      if (g.type === 'sequence_order') {
        const steps = g.steps.map((s) => SHAPE_OF(s.label));
        const last = g.t - 2.7; // the final shape is held from here to past t
        keys.push([last - 1.6 * (steps.length - 1) - 0.7, 'rest', 0.5]); // open hand between the letters and the word
        steps.forEach((s, i) => {
          const at = last - 1.6 * (steps.length - 1 - i);
          keys.push([at, s, 0.4]);
          cards.push({ from: at - 0.4, gate: gi, letters: steps, active: i });
        });
      } else {
        const s = SHAPE_OF(g.label);
        keys.push([g.t - 3.0, s, 0.6]);
        cards.push({ from: g.t - 3.6, gate: gi, letters: [s], active: 0 });
      }
    });
    const lastT = gates[gates.length - 1].t;
    if (gates.length > 1 && lastT + 2.4 < dur - 1.5) {
      // outro: the hand relaxes and the card sums up
      keys.push([lastT + 2.4, 'rest', 0.6]);
      cards.push({ from: lastT + 1.8, gate: -1, letters: [], active: 0 });
    }
    keys.sort((a, b) => a[0] - b[0]);
    const shapeAt = (t) => {
      let S = HAND.SHAPES.rest;
      for (const [at, name, tr] of keys) {
        if (t >= at) S = HAND.SHAPES[name];
        else if (t > at - tr) return HAND.mixShape(S, HAND.SHAPES[name], ease((t - (at - tr)) / tr));
        else break;
      }
      return S;
    };

    const rnd = rng(11);
    const MOTES = Array.from({ length: 70 }, () => [rnd(), rnd(), rnd(), rnd()]);
    const steps = gates.map((g) =>
      g.type === 'sequence_order' ? g.steps.map((s) => SHAPE_OF(s.label)).join(' ') : SHAPE_OF(g.label),
    );

    return (c, t) => {
      // ---- background: night canvas, two slow drifting forms, twinkling motes ----
      fill(c, rrect(0, 0, 1920, 1080, 0), P.canvas);
      fill(c, circle(560 + 40 * wave(t, 19), 560 + 30 * wave(t, 23, 0.3), 520), P.surface);
      fill(c, circle(1560 + 30 * wave(t, 17, 0.6), 980 + 20 * wave(t, 21), 430), rgba(P.surface2, 0.7));
      fill(c, circle(1700 + 25 * wave(t, 29, 0.2), -40, 300), rgba(P.surface, 0.9));
      glow(c, 690, 520, 560, iris, 0.16);
      for (const [x, y, s, ph] of MOTES) {
        const tw = 0.5 + 0.5 * wave(t, 2.5 + 3 * s, ph);
        const col = [P.accents.sky, iris, P.accents.sun, P.accents.lagoon][Math.floor(ph * 4)];
        sparkle(
          c,
          x * 1920,
          (((y * 1080 - t * (6 + 10 * s)) % 1080) + 1080) % 1080,
          3 + 7 * s,
          col,
          0.12 + 0.35 * tw * s,
        );
      }

      // ---- the hand ----
      const rise = backOut(ramp(t, 0.1, 1.3), 0.8);
      const cx = 690,
        cy = 640 + (1 - rise) * 600;
      HAND.draw(c, shapeAt(t), cx, cy, 300, pal);

      // ---- celebration after each step (starts 0.4 s after the gate, when the video is playing again) ----
      gates.forEach((g, gi) => {
        if (gates.length === 1) {
          // one sign: hearts keep rising from the hand after the step, a new one every 0.35 s
          for (let i = 0; i < 40; i++) {
            const born = g.t + 0.4 + i * 0.35,
              k = (t - born) / 2.6;
            if (k <= 0 || k >= 1) continue;
            const r2 = rng(300 + i);
            const x = cx - 40 + (r2() - 0.5) * 460 + 26 * wave(t, 1.6, r2());
            const y = cy - 360 - k * (300 + 160 * r2());
            const a = Math.min(1, k * 6) * (1 - KIT.smooth((k - 0.6) / 0.4));
            fill(
              c,
              KIT.heart(x, y, (26 + 22 * r2()) * backOut(KIT.clamp(k * 4), 2)),
              rgba([P.accents.rose, iris, P.accents.peach][i % 3], a),
            );
          }
          return;
        }
        const k = (t - g.t - 0.4) / 1.6;
        if (k <= 0 || k >= 1) return;
        const r2 = rng(100 + gi);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + r2() * 0.5,
            d = 230 + 160 * backOut(KIT.clamp(k * 1.6), 1.2);
          sparkle(
            c,
            cx + Math.cos(a) * d,
            cy - 260 + Math.sin(a) * d * 0.8,
            (18 + 14 * r2()) * (1 - k),
            [P.accents.sun, iris, P.accents.sky][i % 3],
            1 - k,
          );
        }
      });

      // ---- step chips (top right) ----
      const cur = cards.filter((k) => t >= k.from).pop();
      let x = 1730;
      for (let i = steps.length > 1 ? steps.length - 1 : -1; i >= 0; i--) {
        const w = textWidth(c, steps[i], 34, 800) + 44;
        x -= w;
        const on = cur && cur.gate === i,
          done = t > gates[i].t + 0.4;
        fill(c, rrect(x, 146, w, 60, 30), on ? iris : done ? rgba(iris, 0.28) : rgba(P.surface2, 0.9));
        text(c, steps[i], x + w / 2, 189, 34, on ? P.canvas : done ? P.text : P.textMuted, 800);
        x -= 14;
      }

      // ---- letter card ----
      const cardX = 1130,
        cardY = 250,
        cardW = 600,
        cardH = 560;
      fill(c, rrect(cardX + 18, cardY + 22, cardW, cardH, 44), rgba(P.illustration.shadow, 0.45)); // long shadow
      fill(c, rrect(cardX, cardY, cardW, cardH, 44), P.surface);
      fill(c, rrect(cardX, cardY, cardW, 14, [44, 44, 0, 0]), iris);
      if (!cur) {
        const k = ramp(t, 0.3, 1.0);
        c.globalAlpha = k;
        text(
          c,
          gates.length > 1 ? 'Fingerspelling' : 'Your first sign',
          cardX + cardW / 2,
          cardY + 150,
          40,
          P.textMuted,
          700,
        );
        const title = gates.length > 1 ? steps.slice(0, -1).join(' ') : 'I love you';
        const size = Math.min(150, (cardW - 80) / (textWidth(c, title, 100, 800) / 100));
        text(c, title, cardX + cardW / 2, cardY + 300 + size * 0.2, size, P.text, 800);
        text(c, 'Watch the hand, then copy it.', cardX + cardW / 2, cardY + 460, 34, P.textMuted, 500);
        c.globalAlpha = 1;
      } else if (cur.gate < 0) {
        const k = backOut(ramp(t, cur.from, cur.from + 0.5), 1.6);
        c.save();
        c.translate(cardX + cardW / 2, cardY + 250);
        c.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
        text(c, 'Great', 0, -20, 120, P.text, 800);
        text(c, 'spelling!', 0, 110, 120, iris, 800);
        c.restore();
        text(c, 'Practise with Deaf teachers', cardX + cardW / 2, cardY + 440, 30, P.textMuted, 500);
        text(c, 'and the Deaf community too.', cardX + cardW / 2, cardY + 480, 30, P.textMuted, 500);
      } else {
        const g = gates[cur.gate];
        const pop = backOut(ramp(t, cur.from, cur.from + 0.35), 1.8);
        text(
          c,
          g.type === 'sequence_order' ? 'Spell the word' : cur.letters[0] === 'ILY' ? 'Sign' : 'Letter',
          cardX + cardW / 2,
          cardY + 92,
          36,
          P.textMuted,
          700,
        );
        c.save();
        c.translate(cardX + cardW / 2, cardY + 290);
        c.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop);
        if (cur.letters.length > 1) {
          cur.letters.forEach((s, i) => {
            const on = i === cur.active;
            text(
              c,
              s,
              (i - 1) * 170,
              70,
              on ? 240 : 150,
              on ? P.text : rgba(P.textMuted, i < cur.active ? 0.8 : 0.45),
              800,
            );
          });
        } else if (cur.letters[0] === 'ILY') {
          text(c, 'I love you', 0, 40, 104, P.text, 800);
        } else {
          text(c, cur.letters[0], 0, 110, 300, P.text, 800);
        }
        c.restore();
        // the tip from the track, wrapped to two lines
        const words = (g.fallbackTip || '').split(' ');
        const lines = [''];
        for (const w of words) {
          const trial = (lines[lines.length - 1] + ' ' + w).trim();
          if (textWidth(c, trial, 30, 500) > cardW - 90 && lines[lines.length - 1]) lines.push(w);
          else lines[lines.length - 1] = trial;
        }
        lines
          .slice(0, 3)
          .forEach((l, i) =>
            text(
              c,
              l,
              cardX + cardW / 2,
              cardY + 480 + i * 40 - (lines.length > 2 ? 20 : 0),
              30,
              P.textMuted,
              500,
            ),
          );
      }

      KIT.fade(c, t, dur);
      label(c, LABEL, iris);
    };
  };
})();
