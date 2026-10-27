import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    maxWorkers: 2,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
});
