# Spreadsheets (Docodez plugin)

Spreadsheets attached to a node: **CSV** (and TSV), **Excel** (`.xlsx`, `.xls`) and **LibreOffice** (`.ods`). Cells can
be viewed and edited; the workbook's sheets are tabs at the bottom, like in Excel. A node can have several files: pick
which one to view in the list at the top. TypeScript + [SheetJS](https://sheetjs.com) 0.20.3 (Apache-2.0, from the
official SheetJS CDN: the npm registry version, 0.18.5, is old and has known security issues), built with
[Vite](https://vite.dev). Plugin guide: [`doc/04-plugins.md`](../../doc/04-plugins.md).

```cmd
npm install          (or: yarn)
npm run dev          dev server with reload on save - opens the browser, with a test window.docodez
npm run build        type-checks (tsc) and builds into dist/
npm run package      builds and creates ..\out\lynza.hojas-<version>.dczp  (what gets uploaded to /_admin or opened with a double click)
```

- `public/docodez-plugin.json`: name and description in English, with `i18n` for es / fr (Docodez shows the one for the
  user's language). The UI texts are in `TEXT` (es / en / fr) in `src/main.ts`.
- `src/book.ts`: reading and writing (SheetJS for Excel and ODS; CSV by hand, so files come back as they were: delimiter
  `;` `,` or tab, decimal comma, UTF-8 with or without BOM or Latin-1, leading zeros as text) and what gets
  written to a cell (number, TRUE/FALSE, `=formula` or text).
- `src/grid.ts`: the grid, virtual (only what is visible is drawn). Typing replaces the cell; F2 or double-click edit
  its content; Enter / Tab confirm and move (with Shift, backwards); Esc cancels; Del clears; Ctrl+arrow goes to the edge;
  copy a cell and paste a block (what Excel copies: tabs and line breaks); column widths by dragging the header
  border.
- `src/main.ts`: the file list (`../sdk/picker.ts`, drawn in the page), *Open file...* / *New workbook* /
  dropping a file, the formula bar, the tabs (in edit mode: **+** adds a sheet, double-click renames it, **×** deletes
  it after confirmation). Each change is saved automatically to the same attachment, in its format. The node's
  fallback page is the sheet as a table (indexed by search).

## Limitations

- **Formulas are not recalculated**: the result saved by Excel / LibreOffice is shown. A new formula shows as
  `=...` until the file is opened in Excel or LibreOffice. Changing a value does not update the totals that depend on it.
- Saving a `.xlsx` / `.xls` / `.ods` keeps values, formulas, number formats (dates, %, decimals), column widths and
  merged cells; **colors, fonts and borders are not kept** (SheetJS Community does not write them).
- A CSV has only one sheet.
