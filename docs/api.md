# The `window.docodez` API

Docodez injects the API at the very top of the plugin's entry page `<head>`, before any of your scripts run. There is
nothing to import: `window.docodez` (or just `docodez`) is always there. Every call returns a `Promise`.

TypeScript types: [`sdk/docodez.d.ts`](../sdk/docodez.d.ts). The same API works on every platform:

| Platform | How the plugin runs | Transport |
|---|---|---|
| Windows / Linux / macOS | Docodez's integrated web view, served by a local server on `127.0.0.1` | HTTP (`fetch`) |
| Android | Android WebView, same local server | HTTP (`fetch`) |
| Docodez Web (browser) | A sandboxed `<iframe>` served by the Docodez Web server (opaque origin) | `postMessage` |

You never see the transport: the API hides it. You do see the **sandbox** on the web (see [Rules](#rules)).

- [Versions](#versions-and-feature-detection)
- [Context](#context)
- [Node data](#node-data)
- [Attachments](#attachments)
- [App data (API 2)](#app-data-api-2)
- [Preview page](#preview-page)
- [Files from the user](#files-from-the-user)
- [Camera (API 3)](#camera-api-3)
- [Share a file (API 3)](#share-a-file-api-3)
- [AI (API 3)](#ai-api-3)
- [Events](#events)
- [Rules](#rules)

---

## Versions and feature detection

| `apiVersion` | Adds |
|---|---|
| 1 | Context, node data, attachments, preview page, `pickFile`, events |
| 2 | App data (`getAppData`/`setAppData`/JSON variants, `appdatachange`), `deleteAttachment` |
| 3 | `capturePhoto`, `shareFile`, `aiCapabilities`, `aiExtract`, `aiReadText`; `context.camera`, `context.share`, `context.ai` |

The manifest's `apiVersion` is the **minimum** API your plugin needs: a Docodez with an older API refuses to install
it. To reach more users, declare the lowest version you really need and **detect** newer features at run time:

```ts
const ctx = await docodez.ready;
const canShoot = ctx.camera === true && typeof docodez.capturePhoto === 'function';
const canShare = typeof docodez.shareFile === 'function';
const hasAi = typeof docodez.aiCapabilities === 'function' && (await docodez.aiCapabilities()).includes('image.text');
```

The examples `car-log` and `invoice` declare API 2 and use API 3 features only when they exist.

---

## Context

```ts
const ctx = await docodez.ready;   // also kept in docodez.context once ready
```

| Field | Type | Meaning |
|---|---|---|
| `apiVersion` | number | The API version this Docodez offers (not the one your manifest asks for). |
| `pluginId`, `pluginVersion` | string | Your plugin, as installed. |
| `nodeTitle` | string | The title of the node in the tree. |
| `editable` | boolean | The document is in **edit mode**: you may save. Changes with `modechange`. |
| `theme` | `'light' \| 'dark'` | The reading theme. Changes with `themechange`. |
| `language` | `'es' \| 'en' \| 'fr'` | Docodez's language: use it for your own texts. |
| `platform` | `'desktop' \| 'android' \| 'web'` | Where it runs. Prefer feature detection over platform checks. |
| `camera` | boolean? | API 3: `capturePhoto` can take a photo (Android). |
| `share` | `'share' \| 'save'`? | API 3: what `shareFile` does here — open the system share sheet, or *Save as*. |
| `ai` | string[]? | API 3: AI capabilities available right now (e.g. `['image.text']`). May change while the plugin is open: ask `aiCapabilities()` before using it. |

---

## Node data

Your plugin's data lives **in the node** (inside the user's document): it travels with the file, syncs with Docodez
Web, and is what the user backs up.

```ts
const text = await docodez.getData();          // string | null (null = nothing saved yet)
await docodez.setData('...');                  // edit mode only

const data = await docodez.getJSON<MyData>();  // parsed, or null
await docodez.setJSON(data);                   // edit mode only
```

- `setData` marks the document as modified. It is written to disk when the user saves (Docodez also autosaves).
  There is **no close event**: save shortly after each change (a 300–500 ms debounce works well).
- Keep it text (almost always JSON). Anything binary or big goes into an **attachment**.

---

## Attachments

Files attached to the node. The user also sees them in the node's *Attachments...* dialog.

```ts
const list = await docodez.listAttachments();              // [{ name, size }]
const buffer = await docodez.getAttachment('model.stl');   // ArrayBuffer (rejects if missing)
const url = await docodez.attachmentUrl('photo.jpg');      // for <img src>, fetch, loaders...
await docodez.putAttachment('photo.jpg', blobOrBuffer);    // add or replace; edit mode only
await docodez.deleteAttachment('photo.jpg');               // API 2; edit mode only; no error if missing
```

`putAttachment` accepts an `ArrayBuffer`, a typed array, a `Blob` or a string. Use unique, readable names (prefix them
with your plugin's name: `invoice-logo-1a2b.png`). Shrink photos before storing them (the examples scale to 1600 px
JPEG): everything goes inside the user's document.

---

## App data (API 2)

Data that belongs to the **user**, not to one node: catalogs, templates, preferences, a client list. The same for all
your plugin's nodes and documents.

```ts
const raw = await docodez.getAppData();        // JSON text or null
await docodez.setAppData(JSON.stringify(x));   // must be valid JSON
const obj = await docodez.getAppJSON<T>();
await docodez.setAppJSON(obj);
docodez.on('appdatachange', reload);           // another view of your plugin changed it
```

- Works in **view mode** too (it is not part of the document).
- Maximum 4 MB. Stored per user and per plugin: on desktop/Android in the app data folder, on Docodez Web in the user's
  settings on the server. A plugin only sees its own.

---

## Preview page

```ts
await docodez.setPreview('<h2>Shopping list</h2><ul><li>...</li></ul>');   // edit mode only
```

A plain HTML version of the node. Docodez's **search indexes it**, and it is what users see when your plugin is not
installed. Docodez removes scripts, frames, objects and `on*` attributes. Update it whenever you save; an embedded
`data:` image of your content is a good idea (the 3D viewer adds a snapshot).

---

## Files from the user

```ts
const file = await docodez.pickFile(['.stl', '.obj']);   // { name, data: ArrayBuffer } | null (cancelled)
```

Uses Docodez's own file picker. Do not rely on `<input type="file">`: inside the Android WebView it does not always work.

---

## Camera (API 3)

```ts
if (ctx.camera && docodez.capturePhoto) {
  const photo = await docodez.capturePhoto();   // { name: 'foto-20261022-101500.jpg', data } | null (cancelled)
}
```

Takes a photo with the platform camera (Android). Where there is no camera it rejects: check `ctx.camera` first and
offer `pickFile` otherwise.

---

## Share a file (API 3)

```ts
const result = await docodez.shareFile('Invoice-INV-0001.pdf', pdfBytes, 'application/pdf', 'Invoice INV-0001: $144.84');
// 'shared' | 'saved' | null (cancelled)
```

Sends a file your plugin generated (PDF, image, web page, CSV...) to another app:

- **Android** (`ctx.share === 'share'`): the system share sheet — WhatsApp, SMS, email, Drive... The optional text
  goes with the file.
- **Desktop and web** (`ctx.share === 'save'`): a *Save as* dialog.

Maximum 50 MB. The file name is cleaned (no folders, no invalid characters). An empty `type` is guessed from the
extension.

---

## AI (API 3)

The user configures AI providers in Docodez (their own Ollama, OpenAI, Claude, Groq, LiteLLM... with their own keys and
explicit consent). Your plugin **never sees keys or addresses**: it asks Docodez, and Docodez shows its own progress
window (with your plugin's name, the provider and *Cancel*) while the request runs. Nothing is sent without the user
seeing it.

```ts
const caps = await docodez.aiCapabilities();   // e.g. ['image.text'] — empty: no provider configured

// Read named values from a photo
const values = await docodez.aiExtract(photo.data, 'This is a photo of a fuel pump display.', [
  { name: 'volume', type: 'number', description: 'the amount of fuel dispensed (liters)' },
  { name: 'total',  type: 'number', description: 'the total amount to pay' },
  { name: 'date',   type: 'date',   description: 'the date, if it is a receipt' },
]);
// { volume: 30.5, total: 36.6, date: null }  — or null if the user cancelled

// Read all the text of a photo (OCR)
const text = await docodez.aiReadText(photo.data);   // string | null (cancelled)
```

| `aiExtract` | |
|---|---|
| `image` | `ArrayBuffer` or `Blob` (any format the browser decodes). Docodez applies the EXIF orientation and scales it to 1600 px. |
| `instructions` | What the photo is, in any language (English works best). |
| `fields` | 1 to 30 items. `name`: letters, digits, `_` (max 41 chars; others are ignored). `type`: `number`, `string` or `date` (`YYYY-MM-DD`). `description`: what the value is. |
| Result | An object with every field name: numbers as numbers (Docodez converts `"1.234,5"`, `"45 L"`, `"$36.60"`), strings, dates, or `null` when the value is not clearly visible. |

How Docodez does it: with a vision model, it asks for a JSON object with exactly those fields (a JSON schema); with
only an OCR model, it reads the text and asks the text model to extract the fields.

Rules for AI features:

- Only call these from a **user action** (a button), never on load.
- Always let the user **review** what was read before saving it (the examples fill the form fields and highlight them).
- If `aiCapabilities()` does not include `image.text`, keep the photo anyway and tell the user how to add a provider.
- Errors (no provider, provider down) reject with a message you can show.

---

## Events

```ts
docodez.on('modechange', ({ editable }) => ...);     // the user switched between view and edit mode
docodez.on('themechange', ({ theme }) => ...);       // 'light' | 'dark'
docodez.on('appdatachange', () => ...);              // API 2: another view of your plugin changed the app data
docodez.off('modechange', handler);
```

---

## Rules

- **Read always, write only in edit mode.** In view mode `setData`, `setJSON`, `putAttachment`, `deleteAttachment` and
  `setPreview` reject. Hide or disable your editing controls when `ctx.editable` is false and react to `modechange`.
  App data can be written in both modes.
- **Your node only.** A plugin sees and changes only its own node (data, attachments, preview) and its own app data —
  never other nodes or the rest of the document.
- **Bundle everything.** Libraries, fonts and images go inside the package: plugins must work offline (phones, planes).
  Loading from the internet is possible, but then the plugin does not work without a connection. Public APIs that
  allow cross-origin requests (`Access-Control-Allow-Origin: *`) can be called with `fetch`.
- **Web sandbox.** On Docodez Web your page runs with an opaque origin (`sandbox allow-scripts allow-forms allow-popups
  allow-modals allow-downloads allow-pointer-lock`): no cookies, no access to the Docodez Web API, and `localStorage`
  may be unavailable or not persistent. Use node data or app data for anything that matters, and wrap `localStorage`
  in `try/catch` (fine for per-device conveniences such as a remembered tab).
- **No native pop-ups.** In Docodez's integrated web view (WebView2 inside the window) the browser's own pop-ups —
  `<select>` lists, `<input type="date">`, `<input type="color">`, `<datalist>` — open in the wrong place. Use the
  drop-down list and color picker drawn in the page from [`sdk/picker.ts`](../sdk/picker.ts), plain text inputs for
  dates (the examples use `YYYY-MM-DD` with a *Today* button), and your own suggestion lists.
- **`prompt`, `confirm` and `alert`** do not work well inside Docodez: draw your own dialogs in the page.
- **Navigation.** Links to other sites open in the system browser; your plugin's own pages stay in the node.
- **Sizes.** Package: 200 MB uncompressed, 10 000 files. App data: 4 MB. `shareFile`: 50 MB. Keep node data small
  (it is compressed with the document, but users notice slow saves with huge nodes).

---

## Developing outside Docodez

[`sdk/docodez-dev.ts`](../sdk/docodez-dev.ts) installs a fake `window.docodez` for `npm run dev` (only in development;
it is not in the built plugin):

```ts
import { installDevDocodez } from '../sdk/docodez-dev';
if (import.meta.env.DEV) installDevDocodez('me.myplugin');
```

Node data and app data go to `localStorage`, attachments stay in memory, `pickFile`/`capturePhoto` use a file input,
`shareFile` downloads the file (and keeps it in `docodezDev.lastShared`). In the browser console:

```js
docodezDev.setEditable(false)     // try view mode
docodezDev.setTheme('dark')       // try the dark theme
docodezDev.ai = (fields) => ({ volume: 30.5, total: 36.6 })   // fake AI answers (default: asks each value)
```
