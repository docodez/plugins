# 3D Viewer (Docodez plugin)

3D models (STL, OBJ, GLB/glTF) attached to a node. TypeScript + [three.js](https://threejs.org), built with
[Vite](https://vite.dev). Plugin guide: [`doc/04-plugins.md`](../../doc/04-plugins.md).

```cmd
npm install          (or: yarn)
npm run dev          dev server with reload on save - opens the browser, with a test window.docodez
npm run build        type-checks (tsc) and builds into dist/
npm run package      builds and creates ..\out\lynza.visor3d-<version>.dczp  (what gets uploaded to /_admin or opened with a double click)
```

- `public/docodez-plugin.json` and `public/icon.svg` are copied as is to `dist/`. The plugin version is the one in
  `docodez-plugin.json`.
- `src/main.ts` is the viewer. The Docodez API types are in `../sdk/docodez.d.ts`.
- In `npm run dev` (outside Docodez), `../sdk/docodez-dev.ts` sets up a test `window.docodez`: data goes to
  `localStorage`, attachments stay in memory. In the console: `docodezDev.setEditable(false)` (view mode),
  `docodezDev.setTheme('dark')`. It is not included in the built plugin.
