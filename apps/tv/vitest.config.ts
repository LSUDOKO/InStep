import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkg = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

// Only the pure-TS logic in src/lib is tested in Node; UI is verified on the Vega Virtual Device.
export default defineConfig({
  resolve: {
    alias: [
      { find: '@instep/gate-engine/fixtures', replacement: pkg('gate-engine/src/fixtures.ts') },
      { find: '@instep/gate-engine', replacement: pkg('gate-engine/src/index.ts') },
      { find: '@instep/istep-format', replacement: pkg('istep-format/src/index.ts') },
      { find: '@instep/protocol', replacement: pkg('protocol/src/index.ts') },
      { find: '@instep/gated-player', replacement: pkg('gated-player/src/index.ts') },
    ],
  },
  test: { name: 'tv', include: ['src/lib/**/*.test.ts'] },
});
