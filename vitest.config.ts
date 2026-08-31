import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'frontend/src/**/*.test.ts'],
    globals: false,
  },
});
