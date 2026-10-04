import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: ['parity/**/*.spec.ts', 'e2e/**/*.spec.ts'],
  timeout: 300_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { browserName: 'chromium' },
});
