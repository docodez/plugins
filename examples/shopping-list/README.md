# Shopping List / Lista de compras (plugin de Docodez)

Una lista de compras en un nodo: productos agrupados como en la tienda, con cantidad, nota, fotos y varios precios (precio
por kg / L / unidad y el total estimado), y una calculadora. TypeScript sin dependencias, compilado con
[Vite](https://vite.dev). Guía de plugins: [`doc/04-plugins.md`](../../doc/04-plugins.md). Necesita la **API 2** de Docodez
(datos de la app); con la API 3 (Fase 11f), la foto de un producto también se saca con la cámara.

```cmd
npm install          (o: yarn)
npm run dev          servidor de desarrollo - abre el navegador, con un window.docodez de prueba (datos en localStorage)
npm run build        revisa los tipos (tsc) y compila en dist/
npm run package      compila y arma ..\out\lynza.compras-<versión>.dczp  (lo que se sube a /_admin o se abre con doble clic)
```

## Qué se guarda dónde

- **La lista va en el nodo** (`docodez.setJSON`): productos con nombre, grupo (nombre y emoji), cantidad y unidad, nota,
  fotos, marcado, precios. También el nombre del catálogo con que se hizo. Las **fotos son anexos** del nodo
  (`compras-<producto>-<id>.jpg`, achicadas a 1600 px); al quitar un producto se borran (`deleteAttachment`).
- **Los catálogos van en la app** (`docodez.setAppJSON`, API 2): los mismos para todas las listas y documentos del usuario
  (en Docodez Web, en su configuración del servidor). Se puede tener varios (supermercado, ferretería, electrónica...); al
  crear uno se puede empezar vacío o desde una plantilla (`src/seed.ts`, en inglés, español y francés). La primera vez se
  crea el del supermercado. Cada producto cuenta cuántas veces se agregó (*Frecuentes*).
- Como cada producto de la lista lleva su grupo, una lista abierta en otro Docodez se ve igual aunque ese usuario no tenga
  el catálogo: arriba aparece un aviso para **crear ese catálogo** o **agregar a su catálogo** lo que le falta.

## Tiendas e impuestos (1.1.0)

- **Tiendas** (datos de la app, como los catálogos; ⋮ → *Tiendas...* o *+ Tienda nueva...* en la lista de arriba): nombre,
  emoji, los **catálogos de lo que vende** (una tienda puede tener supermercado y plomería) y su impuesto si es otro que el
  general. Elegir una tienda arriba hace que lo que se agrega vaya a esa tienda, y pasa el catálogo a uno de los suyos.
- Cada producto tiene **tienda** (dónde se piensa comprar). Cada **precio** es de una tienda; el elegido como **precio de
  compra** (●) es el que usa la cuenta y pasa el producto a esa tienda ("lo vi más barato en otra: lo compro ahí"). Marcar
  un producto como comprado guarda el precio de compra (el elegido, o el más barato) y su tienda.
- ⋮ → *Ver por tienda*: la lista agrupada por tienda (cada producto con el emoji de su grupo), con lo que cuesta en cada
  una: subtotal + impuestos = total. *Ver por grupo* vuelve como antes (con la tienda de cada producto en gris).
- **Impuestos**: ⋮ → *Ajustes* (impuesto general en %, la moneda). Cada grupo del catálogo paga o no (en las plantillas la
  comida no paga; un catálogo de antes se completa igual) y un producto puede ser distinto que su grupo (*Editar* el
  catálogo). Al agregar un producto a la lista se copia si paga (viaja con la lista) y se puede cambiar en su editor. Al pie:
  subtotal + impuestos = total, y el carro con impuestos.
- La lista guarda los nombres de sus tiendas (como los grupos): se entiende en otro Docodez. Cambiar el nombre de una
  tienda lo cambia también en la lista abierta.

## Archivos

- `src/model.ts`: los datos (lista y catálogos), buscar, unidades y precios: cada oferta (tienda, precio, cantidad, unidad)
  se pasa a precio por kg / L / m / unidad para compararlas (la más barata se marca); el estimado de un producto es la
  oferta elegida (o la más barata) por la cantidad pedida, convirtiendo unidades (g/kg/lb/oz, ml/L/gal/fl oz, cm/m/ft,
  unidad/docena); sin unidad, la cantidad es de paquetes.
- `src/main.ts`: la pantalla. Agregar escribiendo (con sugerencias del catálogo; "2 kg tomates", "leche x3"), el panel del
  catálogo (al costado en pantallas anchas, a pantalla completa en el celular; buscar, frecuentes, grupos, *Editar* para
  agregar / cambiar / borrar grupos y productos), el editor del producto, el visor de fotos (el 📎 de la fila), el menú
  (ocultar los marcados, desmarcar todo, quitar los marcados, moneda, vaciar) y la página de respaldo (la lista en HTML).
- `src/calc.ts`: la calculadora de la barra (analizador propio, sin `eval`; `200+10%` = 220). Fase 11e: se mueve arrastrando
  su barra de título y tiene historia (las últimas 100 cuentas, en `calcHistory` de los datos de la app).
- `src/i18n.ts`: los textos (es / en / fr). `src/seed.ts`: las plantillas de los catálogos.

## Modo vista

Marcar y cambiar la lista necesita el modo edición de Docodez (como cualquier cambio del documento). Los catálogos se pueden
cambiar siempre: no son del documento.
