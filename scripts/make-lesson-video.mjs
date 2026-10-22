#!/usr/bin/env node
/**
 * Renders an illustrated placeholder instruction video for a lesson from its gates: one title card per step,
 * timed to the gate's `t`, plus an intro and an end card. No people, no third-party assets — a stand-in until the
 * real demonstration is recorded. The card says so on screen.
 *
 *   node scripts/make-lesson-video.mjs <lessonId> [--force]
 *   node scripts/make-lesson-video.mjs --all        # every lesson without a video.mp4
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
/** Lessons with their own illustrated video (scripts/make-kids-video.sh): never overwritten here. */
const HANDMADE = new Set(['kids-forest-walk-v1']);
const FONT = process.env.FONT ?? '/usr/share/fonts/noto/NotoSans-Bold.ttf';
const FONT_R = process.env.FONT_REGULAR ?? '/usr/share/fonts/noto/NotoSans-Regular.ttf';
if (!existsSync(FONT)) throw new Error(`font not found: ${FONT} (set FONT=/path/to/bold.ttf)`);

const PALETTE = {
  fall_prevention: ['0x1F3A5F', '0x2E5A88', '0x3C7A9E', '0x2B6B6B'],
  sign_language: ['0x4A2C6B', '0x6A3FA0', '0x7B52B8', '0x3F2A66'],
  stroke_rehab: ['0x1E5A4A', '0x2B7A62', '0x3C8F72', '0x235E52'],
  cpr: ['0x7A1F2B', '0x9C2E3C', '0xB34050', '0x6B1A25'],
  kids: ['0x1E5631', '0x2F4858', '0xF4A259', '0x5B8E7D'],
};
const CHANNEL_TITLE = {
  fall_prevention: 'Fall Prevention',
  sign_language: 'Sign Language for Families',
  stroke_rehab: 'Stroke Hand Rehab',
  cpr: 'CPR Practice',
  kids: "Kids' Active Storytime",
};

const esc = (s) =>
  String(s).replace(/\\/g, '\\\\').replace(/'/g, '\u2019').replace(/:/g, '\\:').replace(/%/g, '%%');
const txt = (text, size, y, from, to, color = 'white', font = FONT) =>
  `drawtext=fontfile=${font}:text='${esc(text)}':fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}:enable='between(t,${from},${to})'`;
const bg = (color, from, to) =>
  `drawbox=x=0:y=0:w=iw:h=ih:color=${color}:t=fill:enable='between(t,${from},${to})'`;

function render(id, force) {
  if (HANDMADE.has(id)) return console.log(`skip ${id}: has its own illustrated video`);
  const dir = join(ROOT, 'content/lessons', id);
  const out = join(dir, 'video.mp4');
  if (existsSync(out) && !force) return console.log(`skip ${id}: video.mp4 exists`);
  const track = JSON.parse(readFileSync(join(dir, 'track.istep'), 'utf8'));
  const dur = track.video?.durationSec ?? 30;
  const colors = PALETTE[track.channel] ?? PALETTE.kids;
  const gates = [...track.gates].sort((a, b) => a.t - b.t);
  const filters = [];
  const startOf = (g) => (typeof g.rewindTo === 'number' ? g.rewindTo : Math.max(0, g.t - 1.5));
  // intro card until the first step
  const firstT = gates[0]?.t ?? dur;
  filters.push(bg(colors[0], 0, Math.max(0.5, firstT - 1.5)));
  filters.push(txt(track.title, 120, 300, 0, Math.max(0.5, firstT - 1.5)));
  filters.push(
    txt(CHANNEL_TITLE[track.channel] ?? track.channel, 64, 460, 0, Math.max(0.5, firstT - 1.5), '0xFFE8A3'),
  );
  // one card per step: from 1.5 s before the gate until the next step
  // a gate that loops a segment (rewindTo) owns that whole segment, so its card is on screen while it loops
  gates.forEach((g, i) => {
    const from = startOf(g);
    const to = i + 1 < gates.length ? Math.max(from + 0.5, startOf(gates[i + 1])) : dur - 2;
    filters.push(bg(colors[(i + 1) % colors.length], from, to));
    filters.push(txt(`Step ${i + 1} of ${gates.length}`, 54, 150, from, to, '0xFFE8A3'));
    filters.push(txt(g.label, 108, 300, from, to));
    const hint = g.fallbackTip ?? '';
    if (hint)
      filters.push(
        txt(hint.length > 70 ? hint.slice(0, 67) + '…' : hint, 48, 560, from, to, '0xE6EDF3', FONT_R),
      );
    if (g.type === 'hold_duration' && g.holdSec)
      filters.push(txt(`Hold for ${g.holdSec} seconds`, 60, 700, from, to));
    if (g.type === 'rep_count' && g.reps) filters.push(txt(`${g.reps} times`, 60, 700, from, to));
    if (g.type === 'rhythm_bpm' && g.bpm)
      filters.push(txt(`${g.bpm.min}–${g.bpm.max} per minute`, 60, 700, from, to));
    if (g.type === 'safety_prerequisite') filters.push(txt('Safety check', 60, 700, from, to, '0xFFB4B4'));
  });
  filters.push(bg(colors[0], dur - 2, dur));
  filters.push(txt('Well done', 140, 420, dur - 2, dur));
  // honesty strip on every frame
  filters.push(`drawbox=x=0:y=ih-110:w=iw:h=110:color=0x000000@0.55:t=fill`);
  filters.push(
    `drawtext=fontfile=${FONT_R}:text='${esc('Illustrated placeholder — a recorded demonstration replaces this video')}':fontsize=36:fontcolor=0xCBD5E1:x=(w-text_w)/2:y=h-72`,
  );
  const vf = filters.join(',');
  execFileSync(
    'ffmpeg',
    [
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=black:s=1920x1080:r=30:d=${dur}`,
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=48000:cl=stereo',
      '-vf',
      vf,
      '-t',
      String(dur),
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-pix_fmt',
      'yuv420p',
      '-profile:v',
      'high',
      '-c:a',
      'aac',
      '-shortest',
      '-movflags',
      '+faststart',
      out,
    ],
    { stdio: 'inherit' },
  );
  // posters: scripts/make-posters.mjs (text-free art) until a real recording provides a frame
  console.log(`wrote ${id}/video.mp4 (${dur}s, ${gates.length} steps)`);
}

const args = process.argv.slice(2);
const force = args.includes('--force');
if (args.includes('--all')) {
  for (const id of readdirSync(join(ROOT, 'content/lessons')))
    if (existsSync(join(ROOT, 'content/lessons', id, 'track.istep'))) render(id, force);
} else {
  const id = args.find((a) => !a.startsWith('--'));
  if (!id) throw new Error('usage: make-lesson-video.mjs <lessonId> | --all [--force]');
  render(id, force);
}
