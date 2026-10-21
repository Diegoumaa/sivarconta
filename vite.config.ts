import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep the browser coverage of the existing frontend when changing build tools.
  build: {
    target: ['chrome87', 'edge88', 'firefox78', 'safari14']
  },
  server: {
    port: 3000,
    open: false
  }
});
