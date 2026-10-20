import { readFileSync } from 'node:fs';
import { validateTrackText } from './validate';

const [cmd, ...files] = process.argv.slice(2);
if (cmd !== 'validate' || files.length === 0) {
  console.error('Usage: istep validate <file.istep> [more files...]');
  process.exit(2);
}

let failed = 0;
for (const file of files) {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`✗ ${file}: ${(e as Error).message}`);
    failed++;
    continue;
  }
  const r = validateTrackText(text);
  if (r.ok) {
    console.log(`✓ ${file} (${r.value.gates.length} gates)`);
  } else {
    failed++;
    console.error(`✗ ${file}`);
    for (const e of r.errors) console.error(`    ${e.path}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
