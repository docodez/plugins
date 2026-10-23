import { defineConfig } from 'vite';

// Un plugin de Docodez se sirve desde una carpeta propia (y en Docodez Web, aislado): rutas relativas.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true, // limpia dist antes de compilar (lo que hacía parcel-plugin-nuke-dist)
    target: 'es2022', // await de primer nivel; WebView2 y el WebView de Android (Chromium 89+)
    sourcemap: false,
    chunkSizeWarningLimit: 1000, // three.js es grande: no avisar por eso
  },
  server: {
    open: true,
  },
});
