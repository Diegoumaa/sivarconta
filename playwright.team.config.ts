import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './e2e-cloud',
  reporter: [['list']],
  outputDir: 'test-results/team',
  use: { ...base.use, baseURL: 'http://127.0.0.1:4174' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 45_000,
    env: { VITE_SUPABASE_URL: 'https://team-qa.supabase.co', VITE_SUPABASE_ANON_KEY: 'qa-public-fixture' },
  },
});
