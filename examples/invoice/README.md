# Invoice (Docodez plugin)

Invoices, quotes and receipts for small businesses, one per node. Dependency-free TypeScript, built with
[Vite](https://vite.dev). Plugin guide: [`doc/04-plugins.md`](../../doc/04-plugins.md). It declares **API 2**; sharing
needs **API 3** (`docodez.shareFile`).

```cmd
npm install
npm run dev          dev server, with a mock window.docodez (sharing = downloading the file)
npm run build        type-checks (tsc) and builds into dist/
npm run package      builds and creates ..\out\lynza.invoice-<version>.dczp
```

## What is stored where

- **The invoice goes in the node** (`docodez.setJSON`, `Invoice` in `src/model.ts`): type, number, dates, status, language,
  currency, look, the client, the columns, the lines (`cells` per column), taxes, discount, amount paid, notes and
  terms, and **a copy of the business** (`from`): if the address or logo changes later, an old invoice stays the same.
- **The business goes in the app data** (`docodez.setAppJSON`, `Profile`): name, logo (downscaled data URL, longest side
  600 px), address, contact, country, tax numbers, usual taxes, usual columns, template, color, paper,
  numbering (prefix and next number; used when the invoice is saved for the first time), days until due, usual notes
  and terms, the client book, and previously invoiced items (for suggestions).

## The math

Line amount = quantity × price × (1 − discount %) (with no quantity column, 1; with no price column, the amount is typed
in). The invoice discount (% or amount) is spread out: the taxable part goes down in the same proportion. Each
tax is computed on the taxable part (checked lines), rounded to cents. Balance = total − paid (a
*paid* invoice with no amount paid counts as fully paid).

## Countries

`COUNTRIES` in `src/model.ts`: the name of the tax number (GST/HST # in Canada, RFC, NIF, CUIT, RUT, NIT, RUC, RNC, EIN,
VAT Reg. No., ABN, GSTIN...), the currency and the suggested taxes. The rates are only suggestions: they change, and the user
checks them. Add new countries there.

## How it is drawn

- `src/layout.ts`: lays out the pages as drawing operations (rectangles, lines, text, the logo) in points, with the 4 templates
  (classic, modern, minimal, bold), page breaks and the table header repeated on each page. Text widths are
  measured with Arial, which has the same widths as Helvetica (the PDF font).
- `src/render.ts`: draws those operations as SVG (the preview and the web page), on a canvas (the PNG image) and as **PDF**, written
  right there: real text in Helvetica (WinAnsi: Spanish and French accents work; anything else becomes "?"), the
  logo with its transparency (SMask), compressed with `CompressionStream('deflate')`.

## Sharing

📤 *Share* → PDF, image or web page: `docodez.shareFile`. On Android it opens the system share sheet (WhatsApp, SMS,
email...) with a message ("Invoice INV-0001: $144.84 · due ..."); on desktop and on the web, *Save as*. A
draft invoice becomes *sent*.
