# Plugin template: Quick Notes

The smallest useful Docodez plugin: a list of short notes, each with an optional photo, saved in the node. Copy this
folder to start your own (see [Getting started](../docs/getting-started.md)).

```sh
npm install
npm run dev       # in the browser, with a fake window.docodez (data in localStorage)
npm run build     # type-check + build into dist/
npm run package   # build + pack → ../out/example.notes-1.0.0.dczp
```

What it shows:

| File | |
|---|---|
| `public/docodez-plugin.json` | The manifest: change `id`, `name`, `author` first. |
| `public/icon.svg` | The icon of the plugin's nodes (simple shapes, no gradients or text). |
| `src/main.ts` | `docodez.ready`, `getJSON`/`setJSON` with a debounced save, `setPreview`, attachments (`pickFile`, `capturePhoto` when there is a camera, `attachmentUrl`, `deleteAttachment`), `modechange` and `themechange`. |
| `src/i18n.ts` | Texts in English and Spanish, picked with `context.language`. |
| `src/style.css` | Light and dark themes, phone-friendly sizes. |

The template asks for API 2 (`deleteAttachment`) and uses the camera only if the running Docodez offers it (API 3).
