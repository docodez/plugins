# Car Log (Docodez plugin)

Everything about a car in one node: fuel with real consumption, spending, repairs, parts and accessories, trips and
notes. Dependency-free TypeScript, built with [Vite](https://vite.dev). Plugin guide:
[`doc/04-plugins.md`](../../doc/04-plugins.md). Declares **API 2**; if Docodez has **API 3** (Phase 11f), it uses the
camera and AI.

```cmd
npm install
npm run dev          dev server, with a mock window.docodez (data in localStorage)
npm run build        type-checks (tsc) and builds into dist/
npm run package      builds and packs ..\out\lynza.carlog-<version>.dczp
```

In `npm run dev`, the mock "AI" asks for each value; you can change it from the console:
`docodezDev.ai = (fields) => ({ volume: 30.5, price: 1.2, total: null })`.

## What is stored where

- **Everything goes in the node** (`docodez.setJSON`, `src/model.ts` → `CarLog`): the car, the units, and the lists
  `fuel`, `repairs`, `parts`, `trips` and `notes`. Photos and files are node **attachments** (`car-<type>-<id>.jpg`,
  photos shrunk to 1600 px; a PDF keeps its name). A record keeps the names of its attachments in `files`.
- **App data** only remembers the units of the last car configured (for the next one).
- Units belong to the car: numbers are stored in them. Changing them (⚙️) converts everything recorded.

## Consumption (full-tank method)

Between two fill-ups marked *Filled the tank*, the car used what was added after the first one: the partial fills in
between and the one that fills the tank again. `fuelSegments` builds those segments (ordered by odometer); a fill-up marked
*Missed a fill-up before this one* breaks the chain (we don't know how much was added). The average is all the fuel added
in the segments over their total distance; the cost per km is computed the same way from the amount paid.

## Reading from a photo (API 3)

*📷 Read the pump or receipt* and *📷 Read the dashboard*: takes the photo (the camera on Android; otherwise a file is
picked), attaches it to the fill-up and, if an AI provider is configured in Docodez, asks it for the values with
`docodez.aiExtract` (volume, price and total; or the odometer, not the trip meter). The fields are filled in for review;
a missing one is computed from the other two. Without AI, the photo is still kept.

## Maintenance (Phase 11g)

The 🛠️ tab: things that repeat every so much distance and/or every so many months since the last time (`Maintenance`:
`everyDistance`, `everyMonths`, `last`, `history`). `dueInfo` says how much is left (whichever comes first wins) and the
state: overdue, soon (10 % of the interval or 300 left, or 30 days, or ≈ 21 days at the current driving pace:
`distancePerDay`, from dated odometer readings), up to date, or no last time. *✓ Done* records it (and, optionally, as a
repair with its cost). The warning shows when the car is opened and in the summary; there are no system notifications
(Docodez does not run in the background).

## Make and model

`src/vpic.ts`: common makes are built into the plugin; a make's models for a year and *Read the VIN* come from the public
NHTSA database (vPIC, US; free, no account). It is only an aid: you can type anything, and nothing breaks without
internet.

## Files

- `src/model.ts`: the data and calculations (no DOM).
- `src/main.ts`: the UI (tabs, edit sheets, AI reading, fallback page).
- `src/rich.ts`: the rich text editor and `sanitize` (text tags only; pasted content is cleaned).
- `src/vpic.ts`: makes, models and VIN.
- `src/i18n.ts`: the UI strings (es, en, fr) and the "what for" suggestions for each accessory type.
