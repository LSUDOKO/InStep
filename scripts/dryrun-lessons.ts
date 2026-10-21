/**
 * Offline check that the synthetic learner passes every gate of every built-in lesson through the real gate
 * engine (no server, no TV). Fails with exit code 1 if any gate doesn't pass within the time limit.
 *
 *   pnpm dryrun-lessons [--seconds 40]
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createGateRunner } from '@instep/gate-engine';
import { validateTrack } from '@instep/istep-format';
import { behaviourFrame } from './lib/learnerBehaviour';

const { values } = parseArgs({ options: { seconds: { type: 'string', default: '40' } } });
const limitMs = Number(values.seconds) * 1000;
const FPS = 15;
const root = join(new URL('../', import.meta.url).pathname, 'content/lessons');
let failed = 0;
for (const id of readdirSync(root)) {
  const file = join(root, id, 'track.istep');
  if (!existsSync(file)) continue;
  const v = validateTrack(JSON.parse(readFileSync(file, 'utf8')));
  if (!v.ok) {
    console.log(`✗ ${id}: invalid track`);
    failed++;
    continue;
  }
  console.log(`\n${id}`);
  for (const gate of v.value.gates) {
    const runner = createGateRunner(gate, { affectedHand: 'right' });
    let passedAt: number | null = null;
    let last = runner.push(behaviourFrame({ id: gate.id, type: gate.type }, null, 0));
    for (let t = 0; t <= limitMs && passedAt === null; t += 1000 / FPS) {
      last = runner.push(behaviourFrame({ id: gate.id, type: gate.type }, t, t));
      if (last.status === 'passed') passedAt = t;
    }
    const ok = passedAt !== null;
    if (!ok) failed++;
    const worst = last.worst ? ` (${last.worst.hint})` : '';
    console.log(
      `  ${ok ? '✓' : '✗'} ${gate.id} ${gate.type}${ok ? ` passed at ${(passedAt! / 1000).toFixed(1)} s` : ` ${last.status} progress ${last.progress.toFixed(2)}${worst}`}`,
    );
  }
}
console.log(failed ? `\n${failed} gate(s) not passed` : '\nall gates pass');
process.exit(failed ? 1 : 0);
