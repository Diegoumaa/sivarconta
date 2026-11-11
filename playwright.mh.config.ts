import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e-mh', workers: 2, fullyParallel: true, timeout: 30_000,
  expect: { timeout: 8000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/mh-results.json' }]],
  outputDir: 'test-results/mh-artifacts',
  use: { baseURL: 'http://127.0.0.1:4174', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1024 } } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: 'npx vite --host 127.0.0.1 --port 4174 --strictPort', url: 'http://127.0.0.1:4174',
    reuseExistingServer: process.env.SIVAR_E2E_REUSE_SERVER === '1', timeout: 30_000,
    env: { VITE_SUPABASE_URL: 'https://sivar-fact-e2e.supabase.co', VITE_SUPABASE_ANON_KEY: 'publica-ficticia-e2e' } },
});
