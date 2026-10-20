import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/server', 'apps/companion'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/server/src/**'],
      exclude: ['**/*.test.ts', '**/cli.ts', '**/index.ts'],
    },
  },
});
