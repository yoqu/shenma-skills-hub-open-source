import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const backendUrl = process.env.SKILLSTACK_BACKEND_URL || 'http://localhost:8080';

export default defineConfig({
  base: './',
  plugins: [react()],
  envPrefix: ['VITE_', 'SKILLSTACK_'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@skillstack/ui': path.resolve(__dirname, '../packages/ui/src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/uploads': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
});
