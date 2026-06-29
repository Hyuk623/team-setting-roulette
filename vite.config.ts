import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/roulette/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
