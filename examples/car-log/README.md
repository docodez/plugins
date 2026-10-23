# Car Log / Bitácora del carro (plugin de Docodez)

Todo de un carro en un nodo: la gasolina con el consumo real, lo gastado, las reparaciones, las piezas y accesorios, los
viajes y notas. TypeScript sin dependencias, compilado con [Vite](https://vite.dev). Guía de plugins:
[`doc/04-plugins.md`](../../doc/04-plugins.md). Declara la **API 2**; si Docodez tiene la **API 3** (Fase 11f), usa la
cámara y la AI.

```cmd
npm install
npm run dev          servidor de desarrollo, con un window.docodez de prueba (datos en localStorage)
npm run build        revisa los tipos (tsc) y compila en dist/
npm run package      compila y arma ..\out\lynza.carlog-<versión>.dczp
```

En `npm run dev`, la "AI" de prueba pregunta cada dato; en la consola se puede cambiar:
`docodezDev.ai = (fields) => ({ volume: 30.5, price: 1.2, total: null })`.

## Qué se guarda dónde

- **Todo va en el nodo** (`docodez.setJSON`, `src/model.ts` → `CarLog`): el carro, las unidades, y las listas `fuel`,
  `repairs`, `parts`, `trips` y `notes`. Las fotos y archivos son **anexos** del nodo (`car-<tipo>-<id>.jpg`, las fotos
  achicadas a 1600 px; un PDF con su nombre). Un registro guarda los nombres de sus anexos en `files`.
- **Los datos de la app** solo recuerdan las unidades del último carro configurado (para el próximo).
- Las unidades son del carro: los números se guardan en ellas. Cambiarlas (⚙️) convierte todo lo anotado.

## El consumo (método de tanque lleno)

Entre dos cargas con *Llené el tanque*, el carro gastó lo que se cargó después de la primera: las parciales del medio y la
que vuelve a llenar. `fuelSegments` arma esos tramos (ordenados por odómetro); una carga con *Faltó anotar una carga antes*
corta (no se sabe cuánto se cargó). El medio es todo lo cargado en los tramos sobre toda su distancia; el costo por km sale
igual con lo pagado.

## Leer de una foto (API 3)

*📷 Leer la bomba o el recibo* y *📷 Leer el tablero*: saca la foto (la cámara en Android; si no, se elige un archivo), la
deja como anexo de la carga y, si hay un proveedor de AI configurado en Docodez, le pide los datos con `docodez.aiExtract`
(cantidad, precio y total; o el odómetro, no el parcial). Los campos se llenan para revisar; el que falte sale de los otros
dos. Sin AI, la foto queda igual.

## Mantenimiento (Fase 11g)

La pestaña 🛠️: cosas que se repiten cada tanta distancia y/o cada tantos meses desde la última vez (`Maintenance`:
`everyDistance`, `everyMonths`, `last`, `history`). `dueInfo` dice cuánto falta (lo primero que llegue manda) y el estado:
vencido, pronto (falta el 10 % del intervalo o 300, o 30 días, o ≈ 21 días al ritmo de manejo: `distancePerDay`, de los
odómetros con fecha), al día, o sin la última vez. *✓ Hecho* la anota (y, si se quiere, como reparación con su costo). El
aviso se ve al abrir el carro y en el resumen; no hay notificaciones del sistema (Docodez no corre en segundo plano).

## Marca y modelo

`src/vpic.ts`: las marcas comunes están en el plugin; los modelos de una marca en un año y *Leer el VIN* vienen de la base
pública de la NHTSA (vPIC, EE. UU.; gratis, sin cuenta). Es solo una ayuda: se puede escribir cualquier cosa, y sin internet
no pasa nada.

## Archivos

- `src/model.ts`: los datos y las cuentas (sin DOM).
- `src/main.ts`: la pantalla (pestañas, hojas de edición, lectura con AI, página de respaldo).
- `src/rich.ts`: el editor de texto con formato y `sanitize` (solo etiquetas de texto; lo pegado se limpia).
- `src/vpic.ts`: marcas, modelos y VIN.
- `src/i18n.ts`: los textos (es, en, fr) y las sugerencias de "para qué" de cada tipo de accesorio.
