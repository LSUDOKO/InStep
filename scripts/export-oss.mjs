#!/usr/bin/env node
// Assembles the standalone open-source repo "vega-gated-video-player" from the monorepo packages:
//   src/istep  ← packages/istep-format/src     (format, zod schema, validator)
//   src/engine ← packages/gate-engine/src      (pure-TS gate engine + fixtures)
//   src/player ← packages/gated-player         (controller + <GatedPlayer> for Vega)
// Usage: node scripts/export-oss.mjs [outDir]   (default: dist-oss/vega-gated-video-player)
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? join(root, 'dist-oss', 'vega-gated-video-player');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const pkg = (p) => join(root, 'packages', p);
const copy = (from, to) => cpSync(from, join(out, to), { recursive: true });
copy(join(pkg('istep-format'), 'src'), 'src/istep');
copy(join(pkg('gate-engine'), 'src'), 'src/engine');
copy(join(pkg('gated-player'), 'src'), 'src/player');
copy(join(pkg('gated-player'), 'react-native', 'GatedPlayer.tsx'), 'src/player/GatedPlayer.tsx');
copy(join(pkg('istep-format'), 'schema'), 'schema');
copy(join(pkg('istep-format'), 'examples'), 'examples');
copy(join(pkg('istep-format'), 'invalid'), 'test-fixtures/invalid');
rmSync(join(out, 'src/istep/cli.ts'), { force: true });
copy(join(root, 'LICENSE'), 'LICENSE');

// Overlay: README, community files, CI, the web demo (scripts/oss is the source of truth for those).
copy(join(root, 'scripts/oss'), '.');
// Web demo: InStep's synthetic learner, and the two lesson videos (InStep's own animations, CC-BY-4.0).
copy(join(root, 'scripts/lib/learnerBehaviour.ts'), 'demo/learner.ts');
for (const id of ['fall-heel-raise', 'asl-fingerspell-abc'])
  copy(join(root, 'content/lessons', `${id}-v1`, 'video.mp4'), `demo/media/${id}.mp4`);
// README media: real Vega Virtual Device recordings and the gate sequence diagram.
for (const id of ['fall-heel-raise', 'asl-fingerspell-abc'])
  copy(join(root, 'docs/screenshots/tv/gif', `${id}.gif`), `docs/media/tv-${id}.gif`);
copy(join(root, 'docs/architecture/gate-sequence.png'), 'docs/media/gate-sequence.png');

// Rewrite workspace imports to relative paths.
const walk = (d) =>
  readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const target = {
  '@instep/istep-format': 'src/istep/index',
  '@instep/gate-engine/fixtures': 'src/engine/fixtures',
  '@instep/gate-engine': 'src/engine/index',
};
for (const file of [...walk(join(out, 'src')), ...walk(join(out, 'demo'))].filter((f) => /\.tsx?$/.test(f))) {
  let s = readFileSync(file, 'utf8');
  for (const [from, to] of Object.entries(target)) {
    let rel = relative(dirname(file), join(out, to));
    if (!rel.startsWith('.')) rel = `./${rel}`;
    s = s.replaceAll(`'${from}'`, `'${rel}'`);
  }
  s = s.replaceAll("'../src/controller'", "'./controller'");
  // examples moved: ../../istep-format/examples/ → ../../examples/
  s = s.replaceAll('../../istep-format/examples/', '../../examples/');
  // validator tests: examples at the repo root, invalid fixtures under test-fixtures/
  s = s.replace(
    'new URL(`../${d}/`, import.meta.url)',
    "new URL(d === 'invalid' ? '../../test-fixtures/invalid/' : `../../${d}/`, import.meta.url)",
  );
  writeFileSync(file, s);
}

writeFileSync(
  join(out, 'src/index.ts'),
  `export * from './istep/index';\nexport * from './engine/index';\nexport * from './player/index';\n`,
);
writeFileSync(
  join(out, 'src/react-native.ts'),
  `export * from './index';\nexport { GatedPlayer, createFrameStream, type GatedPlayerProps, type FrameStream } from './player/GatedPlayer';\n`,
);

// The OSS release line is versioned on its own (the monorepo packages stay at their versions).
const version = '0.2.0';
writeFileSync(
  join(out, 'package.json'),
  JSON.stringify(
    {
      name: 'vega-gated-video-player',
      version,
      description:
        'Body-aware video for Vega OS: a player that pauses at .istep gates and resumes when live pose or hand landmarks pass them.',
      license: 'MIT',
      author: 'LSUDOKO',
      homepage: 'https://lsudoko.github.io/vega-gated-video-player/',
      bugs: { url: 'https://github.com/LSUDOKO/vega-gated-video-player/issues' },
      repository: 'github:LSUDOKO/vega-gated-video-player',
      keywords: ['vega', 'fire-tv', 'react-native', 'mediapipe', 'pose', 'video', 'istep', 'accessibility'],
      type: 'module',
      main: './src/index.ts',
      'react-native': './src/react-native.ts',
      types: './src/index.ts',
      files: ['src', 'schema', 'examples', '!src/**/*.test.ts'],
      engines: { node: '>=20' },
      scripts: {
        test: 'vitest run',
        typecheck: 'tsc --noEmit && tsc --noEmit -p demo',
        'demo:build':
          'esbuild demo/main.ts --bundle --format=esm --minify --target=es2020 --loader:.istep=json --outfile=demo/dist/main.js',
        'demo:serve': 'npm run demo:build && node demo/serve.mjs 8080',
      },
      dependencies: { zod: '^4.6.7' },
      peerDependencies: { react: '*', 'react-native': '*', '@amazon-devices/react-native-w3cmedia': '*' },
      peerDependenciesMeta: {
        react: { optional: true },
        'react-native': { optional: true },
        '@amazon-devices/react-native-w3cmedia': { optional: true },
      },
      devDependencies: {
        esbuild: '^0.28.2',
        typescript: '~5.9.3',
        vitest: '^5.0.5',
        '@types/node': '^22.10.0',
      },
    },
    null,
    2,
  ) + '\n',
);
writeFileSync(
  join(out, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        lib: ['ES2022'],
        strict: true,
        noUncheckedIndexedAccess: true,
        skipLibCheck: true,
        isolatedModules: true,
        noEmit: true,
        types: ['node'],
      },
      include: ['src'],
      exclude: ['src/player/GatedPlayer.tsx', 'src/react-native.ts'],
    },
    null,
    2,
  ) + '\n',
);
writeFileSync(join(out, '.gitignore'), 'node_modules/\ncoverage/\ndemo/dist/\n');
console.log(`exported to ${relative(root, out)} (${walk(join(out, 'src')).length} source files)`);
if (!existsSync(join(out, 'README.md'))) throw new Error('README missing');
