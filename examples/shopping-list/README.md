# Shopping List (Docodez plugin)

A shopping list in a node: items grouped like in the store, with quantity, note, photos and several prices (price per
kg / L / unit and the estimated total), plus a calculator. Dependency-free TypeScript, built with
[Vite](https://vite.dev). Plugin guide: [`doc/04-plugins.md`](../../doc/04-plugins.md). Needs Docodez **API 2**
(app data); with API 3 (Phase 11f), an item's photo can also be taken with the camera.

```cmd
npm install          (or: yarn)
npm run dev          dev server - opens the browser, with a test window.docodez (data in localStorage)
npm run build        type-checks (tsc) and builds into dist/
npm run package      builds and creates ..\out\lynza.compras-<version>.dczp  (what gets uploaded to /_admin or opened with a double click)
```

## What is stored where

- **The list goes in the node** (`docodez.setJSON`): items with name, group (name and emoji), quantity and unit, note,
  photos, checked state, prices. Also the name of the catalog it was made with. **Photos are node attachments**
  (`compras-<item>-<id>.jpg`, shrunk to 1600 px); removing an item deletes them (`deleteAttachment`).
- **Catalogs go in the app** (`docodez.setAppJSON`, API 2): the same for all of the user's lists and documents
  (in Docodez Web, in their server settings). There can be several (grocery, hardware store, electronics...); a new one
  can start empty or from a template (`src/seed.ts`, in English, Spanish and French). The grocery catalog is created
  the first time. Each item counts how many times it was added (*Frequent*).
- Since each list item carries its group, a list opened in another Docodez looks the same even if that user does not
  have the catalog: a banner at the top offers to **create that catalog** or **add what is missing to their catalog**.

## Stores and taxes (1.1.0)

- **Stores** (app data, like catalogs; ⋮ → *Stores...* or *+ New store...* in the list at the top): name,
  emoji, the **catalogs of what it sells** (a store can have grocery and plumbing) and its tax if different from the
  general one. Picking a store at the top makes new items go to that store, and switches the catalog to one of its own.
- Each item has a **store** (where it will be bought). Each **price** belongs to a store; the one chosen as **purchase
  price** (●) is the one the total uses, and it moves the item to that store ("I saw it cheaper at another one: I'll buy
  it there"). Checking an item as bought saves the purchase price (the chosen one, or the cheapest) and its store.
- ⋮ → *View by store*: the list grouped by store (each item with its group's emoji), with what it costs at each
  one: subtotal + tax = total. *View by group* goes back to the previous view (with each item's store in gray).
- **Taxes**: ⋮ → *Settings* (general tax in %, currency). Each catalog group is taxed or not (in the templates food
  is not; an older catalog gets filled in the same way) and an item can differ from its group (*Edit* the
  catalog). When an item is added to the list, its taxable flag is copied (it travels with the list) and can be changed
  in its editor. At the bottom: subtotal + tax = total, and the cart with tax.
- The list keeps the names of its stores (like the groups), so it makes sense in another Docodez. Renaming a store
  also renames it in the open list.

## Files

- `src/model.ts`: the data (list and catalogs), search, units and prices: each offer (store, price, quantity, unit)
  is converted to a price per kg / L / m / unit to compare them (the cheapest is marked); an item's estimate is the
  chosen offer (or the cheapest) times the requested quantity, converting units (g/kg/lb/oz, ml/L/gal/fl oz, cm/m/ft,
  unit/dozen); with no unit, the quantity counts packages.
- `src/main.ts`: the UI. Adding by typing (with catalog suggestions; "2 kg tomates", "leche x3"), the catalog
  panel (on the side on wide screens, full screen on phones; search, frequent items, groups, *Edit* to add / change /
  delete groups and items), the item editor, the photo viewer (the row's 📎), the menu (hide checked items, uncheck
  all, remove checked items, currency, clear) and the fallback page (the list as HTML).
- `src/calc.ts`: the toolbar calculator (its own parser, no `eval`; `200+10%` = 220). Phase 11e: it moves by dragging
  its title bar and has a history (the last 100 calculations, in `calcHistory` in the app data).
- `src/i18n.ts`: the UI texts (es / en / fr). `src/seed.ts`: the catalog templates.

## View mode

Checking items and changing the list needs Docodez edit mode (like any change to the document). Catalogs can always be
changed: they are not part of the document.
