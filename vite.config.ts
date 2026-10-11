import { defineConfig, type Plugin } from 'vite';

// E2E runs disable HMR/file watching so edits elsewhere can't reload the page mid-test.
const e2e = !!process.env.E2E;

// GitHub Pages serves the raw index.html from the main branch, where it can't run (it points at
// TypeScript), so its pages-redirect block forwards visitors to the build in docs/. Everything Vite
// serves or builds drops that block.
const stripPagesRedirect: Plugin = {
  name: 'strip-pages-redirect',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace(/[ \t]*<!-- pages-redirect -->[\s\S]*?<!-- \/pages-redirect -->\n?/, ''),
  },
};

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [stripPagesRedirect],
  server: e2e ? { hmr: false, watch: { ignored: ['**/*'] } } : undefined,
  build: {
    target: 'es2022',
    // `--mode pages` writes the GitHub Pages build committed in docs/; no source maps there to keep
    // the repository small.
    outDir: mode === 'pages' ? 'docs' : 'dist',
    sourcemap: mode !== 'pages',
    rollupOptions: {
      input: { main: 'index.html' },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
}));
