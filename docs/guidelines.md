# Guidelines

What makes a plugin feel at home in Docodez — and the things that do not work inside it.

## Privacy

- The user's data is **theirs**: keep it in the node (`setJSON`, attachments) or in app data. No analytics, no
  tracking, no sending content anywhere the user did not ask for.
- If your plugin talks to a web service (like `car-log` asking a public database for car models), say so in its
  description, and make it optional: the plugin must keep working without it.
- For AI, use `docodez.aiExtract` / `aiReadText`: the user's own provider, with their consent, and Docodez's progress
  window. Never ask the user for an AI key inside your plugin.
- Let the user **review** anything read automatically (AI, OCR, a web API) before it is saved.

## Works offline

Bundle your libraries, fonts and images (Vite does this). A plugin opened on a plane must work. Network features are
extras.

## Phones first

Many users run Docodez on Android, some on Samsung DeX (desktop-sized windows on a phone).

- Test at 360–400 px wide: no horizontal scrolling, buttons at least 36–40 px high, inputs that do not zoom the page
  (16 px font or `font-size` ≥ 15 px with `viewport` set).
- Use `inputmode` (`decimal`, `numeric`, `email`, `tel`) so phones show the right keyboard.
- Drag-to-move: capture the pointer only once the drag starts (after a few pixels), so buttons inside the dragged area
  still get their clicks.
- Use `capturePhoto` when `context.camera` is true; offer `pickFile` otherwise.

## Things that do not work inside Docodez

| Avoid | Because | Use instead |
|---|---|---|
| `<select>`, `<input type="date">`, `<input type="color">`, `<datalist>` | In Docodez's integrated web view on Windows their pop-ups open in the wrong place | [`sdk/picker.ts`](../sdk/picker.ts) (drop-down list, color picker), text inputs (`YYYY-MM-DD` with a *Today* button), your own suggestion list |
| `prompt()`, `confirm()`, `alert()` | Blocked or out of place | Dialogs drawn in the page |
| `<input type="file">` | Not reliable in the Android WebView | `docodez.pickFile`, `docodez.capturePhoto` |
| `localStorage` for real data | Sandboxed and possibly not persistent on Docodez Web; per device | Node data, app data. `localStorage` (inside `try/catch`) only for small per-device conveniences |
| Cookies, `window.open` to log in somewhere | The web sandbox has an opaque origin | Public APIs with CORS, or nothing |

## Edit mode

Docodez documents have a **view mode** and an **edit mode**. In view mode your plugin can read but not save: hide or
disable editing controls (`context.editable`, `modechange`) and show a short note, as the examples do. App data can be
saved in both modes.

## Theme

Follow `context.theme` and `themechange` (light / dark). Use CSS variables on `body.dark`, as every example does. Keep
good contrast in both.

## Languages

Docodez speaks Spanish, English and French (`context.language`). Ship English at least; add `i18n` in the manifest for
the name and description, and your own texts in a small table (see `template/src/i18n.ts`). Format numbers, money and
dates with `Intl` and the user's language.

## Data that lasts

- Your data outlives your versions: always **accept what older versions saved** (normalize on load, fill defaults).
- Never rename your plugin's `id`.
- Name attachments with a prefix (`invoice-...`), and delete the ones you no longer use (`deleteAttachment`).
- Shrink photos (1600 px JPEG is plenty): everything goes inside the user's document.
- Keep the preview page (`setPreview`) up to date: it is how search finds your content.

## Accessibility

Real `<button>`s with text or `aria-label`, labels for inputs, visible focus, no information carried by color alone
(status chips have words), and keyboard support on desktop (Enter to add, Escape to close).
