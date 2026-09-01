import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/webhook': 'http://localhost:8080',
    },
  },
  resolve: {
    alias: {
      '@jamf/design-system-web-components-next/dist/style.css': resolve(
        __dirname,
        '../node_modules/@jamf/design-system-web-components-next/dist/style.css',
      ),
    },
  },
});
