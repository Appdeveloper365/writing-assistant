import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  timeout: 30000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node api-gateway/server.js',
    url: 'http://localhost:3001/health',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
