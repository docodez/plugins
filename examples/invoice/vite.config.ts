import { defineConfig } from 'vite';

// A Docodez plugin is served from its own folder (and sandboxed in Docodez Web): use relative paths.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true, // clean dist before building (what parcel-plugin-nuke-dist used to do)
    target: 'es2022', // top-level await; WebView2 and the Android WebView (Chromium 89+)
    sourcemap: false,
  },
  server: {
    open: true,
  },
});
