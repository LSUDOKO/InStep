#!/usr/bin/env node
/**
 * Puts each lesson's sound into its video: narration clips + music bed (ducked under the voice) + sound effects,
 * loudness-normalised to about -16 LUFS with peaks held below -1.5 dBTP, AAC 128k stereo 48 kHz.
 * Node + ffmpeg only: it reads the committed stems in content/lessons/<id>/audio/ (made by tts.py and bed.py),
 * so a re-mux never needs the TTS model.
 *
 *  - Drops any existing audio and copies the video stream untouched (-c:v copy), so re-running is idempotent and
 *    the video duration never changes.
 *  - Refuses to mux a lesson whose narration breaks the timing contract (see README.md): every line ends at
 *    least 0.3 s before the next gate t, never straddles a t or a rewindTo, and never overlaps another line.
 *  - Writes a temp file next to video.mp4 and renames it over only if video.mp4 did not change meanwhile.
 *
 *   node scripts/audio/mux.mjs                  # every lesson with a narration file
 *   node scripts/audio/mux.mjs <lessonId> ...
 *   node scripts/audio/mux.mjs --check          # timing contract table only, no muxing
 *   node scripts/audio/mux.mjs --wave <dir>     # also write <dir>/<lessonId>.png (waveform, gate times in red)
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const NARRATION = join(ROOT, 'scripts/audio/narration');
const LEAD = 0.3; // a line ends at least this long before the next gate t
const TARGET_LUFS = -16;
const LIMIT = 0.75; // sample-peak ceiling (-2.5 dBFS) so true peak stays under -1.5 dBTP after AAC

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const waveDir = args.includes('--wave') ? args[args.indexOf('--wave') + 1] : null;
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--wave');

/** Same hash as scripts/audio/tts.py (clip_name). */
const clipName = (voice, speed, text) =>
  `v-${createHash('sha1').update(`${voice}|${speed}|${text}`).digest('hex').slice(0, 12)}.ogg`;

const probe = (file, entries, stream) =>
  execFileSync('ffprobe', [
    '-v',
    'error',
    ...(stream ? ['-select_streams', stream] : []),
    '-show_entries',
    entries,
    '-of',
    'csv=p=0',
    file,
  ])
    .toString()
    .trim();
const seconds = (file, stream) => {
  const s = Number.parseFloat(probe(file, stream ? 'stream=duration' : 'format=duration', stream));
  return Number.isFinite(s) ? s : Number.parseFloat(probe(file, 'format=duration'));
};

/** Timing contract for one lesson. Returns rows for the report; `ok: false` rows block the mux. */
export function checkTiming(lines, gates, durationSec) {
  const ts = gates.map((g) => g.t).sort((a, b) => a - b);
  const rewinds = gates.filter((g) => g.rewindTo !== undefined).map((g) => g.rewindTo);
  let prevEnd = 0;
  return lines.map((l) => {
    const end = l.at + l.dur;
    const next = ts.find((t) => t > l.at);
    const limit = next !== undefined ? next - LEAD : durationSec - 0.2;
    const problems = [];
    if (end > limit + 1e-9)
      problems.push(next !== undefined ? `ends after t=${next} - ${LEAD}` : 'runs past the end');
    for (const r of rewinds) if (l.at < r && end > r) problems.push(`straddles rewindTo=${r}`);
    if (l.at < prevEnd - 1e-9) problems.push('overlaps the previous line');
    prevEnd = end;
    return { ...l, end, next: next ?? null, margin: limit - end, ok: problems.length === 0, problems };
  });
}

function lessonPlan(id) {
  const n = JSON.parse(readFileSync(join(NARRATION, `${id}.json`), 'utf8'));
  const dir = join(ROOT, 'content/lessons', id);
  const track = JSON.parse(readFileSync(join(dir, 'track.istep'), 'utf8'));
  const audio = join(dir, 'audio');
  const lines = n.lines
    .map((l) => {
      const file = join(audio, clipName(l.voice ?? n.voice, l.speed ?? n.speed, l.text));
      if (!existsSync(file))
        throw new Error(`${id}: missing clip for "${l.text}" — run: uv run scripts/audio/tts.py ${id}`);
      return { at: l.at, text: l.text, file, dur: seconds(file) };
    })
    .sort((a, b) => a.at - b.at);
  const sfx = (n.sfx ?? []).map((s) => ({ at: s.at, file: join(audio, `${s.name}.ogg`) }));
  for (const s of sfx)
    if (!existsSync(s.file))
      throw new Error(`${id}: missing ${s.file} — run: uv run scripts/audio/bed.py ${id}`);
  const bed = join(audio, 'bed.ogg');
  return { id, dir, track, lines, sfx, bed: existsSync(bed) ? bed : null };
}

function printTable(id, rows) {
  console.log(`\n[mux] ${id} — timing contract (line end vs next gate t)`);
  for (const r of rows)
    console.log(
      `  ${r.ok ? 'ok ' : 'BAD'} ${r.at.toFixed(2).padStart(6)} → ${r.end.toFixed(2).padStart(6)}  ` +
        `next t ${r.next === null ? '  end' : String(r.next).padStart(5)}  margin ${r.margin.toFixed(2).padStart(5)}s  ` +
        `"${r.text}"${r.ok ? '' : `  ← ${r.problems.join('; ')}`}`,
    );
}

/** filter_complex for the mix: inputs are 0 = video, then clips, then sfx, then bed. */
function mixGraph(plan, dur) {
  const fmt = 'aformat=sample_rates=48000:channel_layouts=stereo';
  const parts = [];
  const voices = plan.lines.map((l, i) => {
    parts.push(`[${i + 1}:a]${fmt},adelay=delays=${Math.round(l.at * 1000)}:all=1[v${i}]`);
    return `[v${i}]`;
  });
  // padded to the full length: the sidechain would otherwise end the ducked bed after the last line
  parts.push(
    `${voices.join('')}amix=inputs=${voices.length}:normalize=0:dropout_transition=0,apad=whole_dur=${dur}[voice]`,
  );
  const layers = [];
  plan.sfx.forEach((s, i) => {
    parts.push(
      `[${plan.lines.length + 1 + i}:a]${fmt},adelay=delays=${Math.round(s.at * 1000)}:all=1[s${i}]`,
    );
    layers.push(`[s${i}]`);
  });
  if (plan.bed) {
    const b = plan.lines.length + plan.sfx.length + 1;
    parts.push(`[voice]asplit=2[vo][key]`);
    parts.push(`[${b}:a]${fmt}[bed]`);
    // duck the bed about 8 dB while the coach speaks
    parts.push(`[bed][key]sidechaincompress=threshold=0.015:ratio=4:attack=30:release=450:makeup=1[ducked]`);
    layers.unshift('[vo]', '[ducked]');
  } else layers.unshift('[voice]');
  parts.push(
    `${layers.join('')}amix=inputs=${layers.length}:normalize=0:dropout_transition=0,apad,atrim=0:${dur}[mix]`,
  );
  return parts.join(';');
}

function inputs(plan) {
  return [
    ...plan.lines.map((l) => l.file),
    ...plan.sfx.map((s) => s.file),
    ...(plan.bed ? [plan.bed] : []),
  ].flatMap((f) => ['-i', f]);
}

function ffmpeg(argv) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...argv], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed:\n${r.stderr.slice(-2000)}`);
  return r.stderr;
}

function loudness(file) {
  const err = ffmpeg(['-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = err.slice(err.lastIndexOf('Summary:'));
  const num = (re) => Number.parseFloat(summary.match(re)?.[1] ?? 'NaN');
  return {
    lufs: num(/I:\s+(-?[\d.]+) LUFS/),
    lra: num(/LRA:\s+(-?[\d.]+) LU/),
    truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/),
  };
}

function mux(plan) {
  const video = join(plan.dir, 'video.mp4');
  if (!existsSync(video)) return console.log(`[mux] ${plan.id}: no video.mp4, skipped`);
  const before = statSync(video);
  const dur = seconds(video, 'v:0');
  const graph = mixGraph(plan, dur);

  // pass 1: measure the premix, pass 2: gain to the target, soft limiter, AAC, video copied
  const err = ffmpeg([
    '-i',
    video,
    ...inputs(plan),
    '-filter_complex',
    `${graph};[mix]loudnorm=print_format=json[m]`,
    '-map',
    '[m]',
    '-f',
    'null',
    '-',
  ]);
  const measured = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1));
  const gain = TARGET_LUFS - Number.parseFloat(measured.input_i);
  const tmp = join(plan.dir, '.video.mux.tmp.mp4');
  ffmpeg([
    '-y',
    '-i',
    video,
    ...inputs(plan),
    '-filter_complex',
    `${graph};[mix]volume=${gain.toFixed(2)}dB,alimiter=limit=${LIMIT}:attack=5:release=60:level=false[out]`,
    '-map',
    '0:v:0',
    '-map',
    '[out]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-t',
    String(dur),
    '-map_metadata',
    '-1',
    '-movflags',
    '+faststart',
    tmp,
  ]);

  const after = statSync(video);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
    rmSync(tmp);
    throw new Error(
      `${plan.id}: video.mp4 changed while muxing (re-rendered?) — not replaced; re-run the mux`,
    );
  }
  const newDur = seconds(tmp, 'v:0');
  if (Math.abs(newDur - dur) > 0.04) {
    rmSync(tmp);
    throw new Error(`${plan.id}: video duration changed ${dur} → ${newDur}; not replaced`);
  }
  renameSync(tmp, video);
  const l = loudness(video);
  console.log(
    `[mux] ${plan.id}: video ${dur.toFixed(3)} s (unchanged), audio ${probe(video, 'stream=codec_name,sample_rate,channels', 'a:0')}, ` +
      `${l.lufs} LUFS, LRA ${l.lra} LU, true peak ${l.truePeak} dBTP`,
  );
  if (waveDir) wave(plan, video, dur);
}

function wave(plan, video, dur) {
  const W = 1600,
    H = 240;
  const marks = plan.track.gates
    .flatMap((g) => [[g.t, 'red'], ...(g.rewindTo !== undefined ? [[g.rewindTo, 'orange']] : [])])
    .map(([t, c]) => `drawbox=x=${Math.round((t / dur) * W)}:y=0:w=3:h=${H}:color=${c}:t=fill`);
  ffmpeg([
    '-y',
    '-i',
    video,
    '-f',
    'lavfi',
    '-i',
    `color=c=0x14142a:s=${W}x${H}`,
    '-filter_complex',
    `[0:a]showwavespic=s=${W}x${H}:colors=white:scale=sqrt[w];[1][w]overlay,${marks.join(',')}`,
    '-frames:v',
    '1',
    join(waveDir, `${plan.id}.png`),
  ]);
}

const ids = readdirSync(NARRATION)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .filter((id) => only.length === 0 || only.includes(id));
let bad = 0;
for (const id of ids) {
  const plan = lessonPlan(id);
  const rows = checkTiming(plan.lines, plan.track.gates, plan.track.video.durationSec);
  printTable(id, rows);
  if (rows.some((r) => !r.ok)) {
    bad++;
    console.log(`[mux] ${id}: timing contract broken — not muxed`);
    continue;
  }
  if (checkOnly) continue;
  try {
    mux(plan);
  } catch (e) {
    bad++; // e.g. a video still being rendered (no moov atom yet): report it and go on with the others
    console.log(`[mux] ${id}: FAILED — ${e.message.split('\n')[0]}`);
  }
}
if (bad) process.exit(1);
