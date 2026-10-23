import { defineConfig } from 'vite';

// A Docodez plugin is served from its own folder (and, on Docodez Web, sandboxed): relative paths.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022', // top-level await; WebView2 and the Android WebView (Chromium 89+)
    sourcemap: false,
  },
  server: {
    open: true,
  },
});
