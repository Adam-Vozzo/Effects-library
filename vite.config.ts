import { defineConfig } from 'vite';

// E2E runs disable HMR/file watching so edits elsewhere can't reload the page mid-test.
const e2e = !!process.env.E2E;

export default defineConfig({
  base: './',
  server: e2e ? { hmr: false, watch: { ignored: ['**/*'] } } : undefined,
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
