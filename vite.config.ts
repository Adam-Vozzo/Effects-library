import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: { main: 'index.html' },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
