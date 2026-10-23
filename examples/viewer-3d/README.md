# Visor 3D (plugin de Docodez)

Modelos 3D (STL, OBJ, GLB/glTF) anexos a un nodo. TypeScript + [three.js](https://threejs.org), compilado con
[Vite](https://vite.dev). Guía de plugins: [`doc/04-plugins.md`](../../doc/04-plugins.md).

```cmd
npm install          (o: yarn)
npm run dev          servidor de desarrollo con recarga al guardar - abre el navegador, con un window.docodez de prueba
npm run build        revisa los tipos (tsc) y compila en dist/
npm run package      compila y arma ..\out\lynza.visor3d-<versión>.dczp  (lo que se sube a /_admin o se abre con doble clic)
```

- `public/docodez-plugin.json` y `public/icon.svg` se copian tal cual a `dist/`. La versión del plugin es la de
  `docodez-plugin.json`.
- `src/main.ts` es el visor. Los tipos de la API de Docodez están en `../sdk/docodez.d.ts`.
- En `npm run dev` (fuera de Docodez) `../sdk/docodez-dev.ts` pone un `window.docodez` de prueba: los datos van al
  `localStorage`, los anexos quedan en memoria. En la consola: `docodezDev.setEditable(false)` (modo vista),
  `docodezDev.setTheme('dark')`. No va en el plugin compilado.
