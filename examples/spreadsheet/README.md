# Spreadsheets / Hojas de cálculo (plugin de Docodez)

Planillas anexas a un nodo: **CSV** (y TSV), **Excel** (`.xlsx`, `.xls`) y **LibreOffice** (`.ods`). Se ven y se
editan las celdas; las hojas del libro son pestañas abajo, como en Excel. Un nodo puede tener varios archivos: se elige
cuál ver en la lista de arriba. TypeScript + [SheetJS](https://sheetjs.com) 0.20.3 (Apache-2.0, del CDN oficial de
SheetJS: la versión del registro de npm, 0.18.5, es vieja y tiene fallas de seguridad conocidas), compilado con
[Vite](https://vite.dev). Guía de plugins: [`doc/04-plugins.md`](../../doc/04-plugins.md).

```cmd
npm install          (o: yarn)
npm run dev          servidor de desarrollo con recarga al guardar - abre el navegador, con un window.docodez de prueba
npm run build        revisa los tipos (tsc) y compila en dist/
npm run package      compila y arma ..\out\lynza.hojas-<versión>.dczp  (lo que se sube a /_admin o se abre con doble clic)
```

- `public/docodez-plugin.json`: nombre y descripción en inglés, con `i18n` para es / fr (Docodez muestra el del idioma
  del usuario). Los textos de la pantalla están en `TEXT` (es / en / fr) en `src/main.ts`.
- `src/book.ts`: leer y escribir (SheetJS para Excel y ODS; los CSV a mano, para que vuelvan como vinieron: separador
  `;` `,` o tabulación, coma decimal, UTF-8 con o sin BOM o Latin-1, ceros a la izquierda como texto) y lo que se
  escribe en una celda (número, TRUE/FALSE, `=fórmula` o texto).
- `src/grid.ts`: la grilla, virtual (solo se dibuja lo que se ve). Escribir reemplaza la celda; F2 o doble clic editan
  lo que tiene; Enter / Tab confirman y avanzan (con Mayús, al revés); Esc cancela; Supr borra; Ctrl+flecha va al borde;
  copiar una celda y pegar un bloque (lo que copia Excel: tabulaciones y saltos de línea); ancho de las columnas
  arrastrando el borde del encabezado.
- `src/main.ts`: la lista de archivos (`../sdk/picker.ts`, dibujada en la página), *Abrir archivo...* / *Libro nuevo* /
  soltar un archivo, la barra de fórmulas, las pestañas (en modo edición: **+** agrega una hoja, doble clic le cambia
  el nombre, **×** la borra con confirmación). Cada cambio se guarda solo en el mismo anexo, en su formato. La página de
  respaldo del nodo es la hoja como tabla (la indexa la búsqueda).

## Límites

- **Las fórmulas no se recalculan**: se muestra el resultado que guardó Excel / LibreOffice. Una fórmula nueva se ve como
  `=...` hasta abrir el archivo en Excel o LibreOffice. Cambiar un valor no actualiza los totales que dependen de él.
- Al guardar un `.xlsx` / `.xls` / `.ods` se conservan los valores, las fórmulas, los formatos de número (fechas, %,
  decimales), los anchos de columna y las celdas combinadas; **los colores, las fuentes y los bordes no** (SheetJS
  Community no los escribe).
- Un CSV tiene una sola hoja.
