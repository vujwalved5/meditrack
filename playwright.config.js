import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.(js|mjs)/,
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  snapshotPathTemplate: '{testDir}/baseline/desktop/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
  },
  webServer: {
    command: 'node tests/serve.cjs',
    port: 4173,
    reuseExistingServer: true,
    timeout: 10000,
  },
});
