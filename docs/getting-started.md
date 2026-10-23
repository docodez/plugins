# Getting started

You need [Node.js](https://nodejs.org) 22 or newer and Docodez (desktop, Android or a Docodez Web server).

## 1. Copy the template

```sh
git clone https://github.com/docodez/plugins
cd plugins
cp -r template my-plugin
```

Keep your plugin next to `sdk/` and `tools/` (the template uses `../sdk` and `../tools`), or copy those two folders
next to it.

Edit `my-plugin/public/docodez-plugin.json`:

```json
{
  "id": "yourname.myplugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "author": "Your Name",
  "apiVersion": 2
}
```

The `id` is **permanent**: nodes store it. Pick it once (`yourname.something`). See [the manifest](manifest.md).

## 2. Develop in the browser

```sh
cd my-plugin
npm install
npm run dev
```

Vite opens the plugin with a **fake `window.docodez`** ([`sdk/docodez-dev.ts`](../sdk/docodez-dev.ts)): your data goes
to `localStorage`, attachments stay in memory, the file picker is a normal file input. It reloads on every save. In
the browser console:

```js
docodezDev.setEditable(false)   // view mode: your editing controls should disappear
docodezDev.setTheme('dark')
```

Check it at phone width too (the browser's device toolbar): many users run Docodez on Android.

## 3. The shape of a plugin

```ts
const ctx = await docodez.ready;                         // language, theme, edit mode, platform...
let data = (await docodez.getJSON()) ?? { items: [] };   // your node's data (null the first time)

function changed() {                                     // after each change: save soon (no close event exists)
  clearTimeout(timer);
  timer = setTimeout(async () => {
    await docodez.setJSON(data);
    await docodez.setPreview(renderPlainHtml(data));     // searchable; shown where your plugin is missing
  }, 400);
}

docodez.on('modechange', ({ editable }) => toggleEditing(editable));
docodez.on('themechange', ({ theme }) => document.body.classList.toggle('dark', theme === 'dark'));
```

Everything else: [the API reference](api.md).

## 4. Package and install

```sh
npm run package      # type-check, build into dist/, pack → ../out/yourname.myplugin-0.1.0.dczp
```

Install it in Docodez:

- **Windows**: double-click the `.dczp` (with Docodez installed), or *Plugins... → Install a package*.
- **Android**: open the file with Docodez (*Open with → Docodez*), or *Plugins... → Install a package*.
- **Docodez Web**: an administrator uploads it on the server's `/_admin` page (see [Publishing](publishing.md)).

Docodez shows the name, version, author and description, and installs it if you accept. Then create a node: *New → your
plugin* (on older versions, *New HTML node → Type → your plugin*).

## 5. Release a new version

Bump `version` in the manifest (Docodez compares numbers: `0.1.10` > `0.1.9`) and package again. Installing the new
`.dczp` replaces the old one; nodes keep their data. Your code must accept the data older versions saved — normalize
on load, as the template's `normalize()` does.

## Next

- [Guidelines](guidelines.md): what works inside Docodez and what does not (native pop-ups, `prompt`, offline).
- The [examples](../examples): app data, PDFs, the camera and AI.
