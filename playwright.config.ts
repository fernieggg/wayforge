import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/parity',
  timeout: 300_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { browserName: 'chromium' },
});
