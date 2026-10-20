/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev: `pnpm server` on :8787 (http or https) + `pnpm --filter @instep/companion dev`.
const target = process.env.INSTEP_SERVER ?? 'http://localhost:8787';

export default defineConfig({
  base: '/c/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target, secure: false },
      '/media': { target, secure: false },
      '/models': { target, secure: false },
      '/ws': { target, ws: true, secure: false },
    },
  },
  build: { target: 'es2022', sourcemap: true },
  test: { name: 'companion', environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
});
