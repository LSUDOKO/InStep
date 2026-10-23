#!/usr/bin/env node
/**
 * Lesson poster art (the TV's Top Shelf, lesson page and cards).
 *  - Real recording (video.mp4 without a `video.placeholder` marker): a frame grabbed from the footage just
 *    after the first step starts, so the poster shows the real teacher.
 *  - Placeholder video (marker present, written by scripts/make-lesson-video.mjs): text-free channel-coloured
 *    art, so the TV never shows a title card behind the title.
 *
 *   node scripts/make-posters.mjs            # every lesson
 *   node scripts/make-posters.mjs <lessonId>
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
// [deep, light] per channel (Blue Hour, docs/brand/palette.json): the night-indigo canvas rising into a deep
// shade of the channel colour (oklch L 0.46), so white type on the TV reads over both (>= 6.4:1)
const FIELD = {
  fall_prevention: ['0x0D0E2C', '0x005F8E'],
  sign_language: ['0x0D0E2C', '0x5A4A90'],
  stroke_rehab: ['0x0D0E2C', '0x006A68'],
  cpr: ['0x0D0E2C', '0x873A58'],
  kids: ['0x0D0E2C', '0x755010'],
};

function poster(id) {
  const dir = join(ROOT, 'content/lessons', id);
  const track = JSON.parse(readFileSync(join(dir, 'track.istep'), 'utf8'));
  const video = join(dir, track.video?.src ?? 'video.mp4');
  if (existsSync(video) && !existsSync(join(dir, 'video.placeholder'))) {
    const t = Math.max(0.5, (Math.min(...track.gates.map((g) => g.t)) || 2) + 0.5);
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(t),
      '-i',
      video,
      '-frames:v',
      '1',
      '-vf',
      'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720',
      '-q:v',
      '3',
      join(dir, 'poster.jpg'),
    ]);
    return console.log(`wrote ${id}/poster.jpg (frame at ${t}s of the real video)`);
  }
  const [a, b] = FIELD[track.channel] ?? FIELD.kids;
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `gradients=s=1280x720:c0=${a}:c1=${b}:x0=0:y0=720:x1=1280:y1=0:nb_colors=2:d=1`,
    '-frames:v',
    '1',
    '-vf',
    'noise=alls=6:allf=t,vignette=PI/5',
    '-q:v',
    '3',
    join(dir, 'poster.jpg'),
  ]);
  console.log(`wrote ${id}/poster.jpg`);
}

const id = process.argv[2];
if (id) poster(id);
else
  for (const d of readdirSync(join(ROOT, 'content/lessons')))
    if (existsSync(join(ROOT, 'content/lessons', d, 'track.istep'))) poster(d);
