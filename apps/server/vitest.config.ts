import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { name: 'server', testTimeout: 90_000 } });
