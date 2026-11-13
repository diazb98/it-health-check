import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  retries: 1, // un reintento para no alertar por un parpadeo de red
  workers: 4,
  reporter: [
    ['list'],
    ['./reporters/health-reporter.ts', { outputDir: 'health-report' }],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'off',
    ignoreHTTPSErrors: false,
  },
  projects: [
    { name: 'api', testMatch: /api\.spec\.ts/ },
    { name: 'ui', testMatch: /ui\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'ssl', testMatch: /ssl\.spec\.ts/ },
  ],
});
