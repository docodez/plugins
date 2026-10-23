# Invoice / Facturas (plugin de Docodez)

Facturas, cotizaciones y recibos para negocios pequeños, cada una en un nodo. TypeScript sin dependencias, compilado con
[Vite](https://vite.dev). Guía de plugins: [`doc/04-plugins.md`](../../doc/04-plugins.md). Declara la **API 2**; para
compartir hace falta la **API 3** (`docodez.shareFile`).

```cmd
npm install
npm run dev          servidor de desarrollo, con un window.docodez de prueba (compartir = bajar el archivo)
npm run build        revisa los tipos (tsc) y compila en dist/
npm run package      compila y arma ..\out\lynza.invoice-<versión>.dczp
```

## Qué se guarda dónde

- **La factura va en el nodo** (`docodez.setJSON`, `Invoice` en `src/model.ts`): tipo, número, fechas, estado, idioma,
  moneda, aspecto, el cliente, las columnas, los renglones (`cells` por columna), impuestos, descuento, pagado, notas y
  condiciones, y **una copia del negocio** (`from`): si después cambia la dirección o el logo, una factura vieja no cambia.
- **El negocio va en los datos de la app** (`docodez.setAppJSON`, `Profile`): nombre, logo (data URL achicado, lado mayor
  600 px), dirección, contacto, país, números fiscales, impuestos de siempre, columnas de siempre, plantilla, color, papel,
  numeración (prefijo y próximo número; se usa cuando la factura se guarda por primera vez), días para el vencimiento, notas
  y condiciones de siempre, la libreta de clientes y lo facturado antes (para sugerir).

## Las cuentas

Importe del renglón = cantidad × precio × (1 − descuento %) (sin columna de cantidad, 1; sin columna de precio, se escribe
el importe). El descuento de la factura (% o monto) se reparte: lo que paga impuestos baja en la misma proporción. Cada
impuesto se calcula sobre lo que paga impuestos (renglones marcados), redondeado a centavos. Saldo = total − pagado (una
factura *pagada* sin monto pagado cuenta como pagada entera).

## Países

`COUNTRIES` en `src/model.ts`: cómo se llama el número fiscal (GST/HST # en Canadá, RFC, NIF, CUIT, RUT, NIT, RUC, RNC, EIN,
VAT Reg. No., ABN, GSTIN...), la moneda y los impuestos sugeridos. Los porcentajes son sugerencias: cambian, y la persona
los revisa. Uno nuevo se agrega ahí.

## Cómo se dibuja

- `src/layout.ts`: arma las páginas como dibujos (rectángulos, líneas, textos, el logo) en puntos, con las 4 plantillas
  (clásica, moderna, simple, llamativa), cortes de página y el encabezado de la tabla repetido. Los anchos de los textos se
  miden con Arial, que tiene los mismos anchos que Helvetica (la letra del PDF).
- `src/render.ts`: esos dibujos en SVG (la vista previa y la página web), en un canvas (la imagen PNG) y en **PDF**, escrito
  ahí mismo: texto de verdad con Helvetica (WinAnsi: los acentos del español y del francés entran; lo que no, sale "?"), el
  logo con su transparencia (SMask), comprimido con `CompressionStream('deflate')`.

## Compartir

📤 *Compartir* → PDF, imagen o página web: `docodez.shareFile`. En Android abre el selector del sistema (WhatsApp, SMS,
correo...) con un mensaje ("Factura INV-0001: $144.84 · vence ..."); en la computadora y en la web, *Guardar como*. Una
factura en borrador pasa a *enviada*.
