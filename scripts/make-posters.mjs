#!/usr/bin/env node
/**
 * Text-free poster art for lessons that don't have a real video frame yet: a soft two-colour field in the
 * channel's palette with grain and a vignette, so the TV's Top Shelf and product pages have artwork that
 * reads as artwork, not as another title. Replaced automatically when a lesson gets a recorded video
 * (scripts/make-lesson-video.mjs and Creator Studio write a frame from the real footage).
 *
 *   node scripts/make-posters.mjs            # every lesson whose poster.jpg came from a placeholder video
 *   node scripts/make-posters.mjs <lessonId>
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
/** Lessons with their own illustrated video, whose poster is a real frame: left alone. */
const HANDMADE = new Set(['kids-forest-walk-v1']);
// [deep, light] per channel — muted, so white type on the TV reads over them
const FIELD = {
  fall_prevention: ['0x0B2A3A', '0x2F7F86'],
  sign_language: ['0x1E1238', '0x7A4FB0'],
  stroke_rehab: ['0x0C2A24', '0x3F8F6E'],
  cpr: ['0x2A0A10', '0xA83A4A'],
  kids: ['0x13301E', '0xD9934A'],
};

function poster(id) {
  if (HANDMADE.has(id)) return console.log(`skip ${id}: has a real frame`);
  const dir = join(ROOT, 'content/lessons', id);
  const track = JSON.parse(readFileSync(join(dir, 'track.istep'), 'utf8'));
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
