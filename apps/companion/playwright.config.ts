import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const PORT = 18787;
export const TV_PORT = 18788;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
    permissions: ['camera'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm --filter @instep/server start',
    url: `http://localhost:${TV_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      TV_HTTP_PORT: String(TV_PORT),
      PUBLIC_URL: `http://localhost:${PORT}`,
      DATA_DIR: mkdtempSync(join(tmpdir(), 'instep-e2e-')),
      HTTPS_CERT: '',
      HTTPS_KEY: '',
    },
  },
});
