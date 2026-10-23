# Docodez plugins

[Docodez](https://docodez.com) is a notes app that keeps everything in a tree: pages, Markdown, code, photo albums,
PDFs, attachments — on Windows, Android and the web. **Plugins** add new kinds of nodes.

A plugin is a small **web app** (HTML + JavaScript or TypeScript; React, Vue, three.js or plain JS) that Docodez shows
inside a node of the tree. It saves its data **in that node** and in the node's attachments, so it travels with the
user's document, syncs, and is backed up with it. It runs sandboxed and only sees its own node.

| | |
|---|---|
| [Getting started](docs/getting-started.md) | Build your first plugin from the template in a few minutes |
| [API reference](docs/api.md) | Everything `window.docodez` offers: data, attachments, app data, camera, share, AI |
| [Manifest and package](docs/manifest.md) | `docodez-plugin.json` and the `.dczp` package |
| [AI provider plugins](docs/ai-plugins.md) | Add an AI provider with just a manifest |
| [Guidelines](docs/guidelines.md) | Privacy, phones, themes, languages, things that do not work inside Docodez |
| [Publishing](docs/publishing.md) | How users get your plugin |

## Quick start

```sh
cp -r template my-plugin     # then edit my-plugin/public/docodez-plugin.json (id, name, author)
cd my-plugin
npm install
npm run dev                  # develop in the browser with a fake window.docodez
npm run package              # → ../out/<id>-<version>.dczp
```

Open the `.dczp` with Docodez (double-click on Windows, *Open with → Docodez* on Android, or *Plugins... → Install a
package*) and create a node of your plugin. Requirements: Node.js 22 or newer.

## Examples

All of them are real plugins shipped with Docodez. Each folder has its own README.

| Plugin | What it does | Shows |
|---|---|---|
| [`template`](template) | Quick Notes: a list of notes with photos | The essentials, in one small file |
| [`examples/shopping-list`](examples/shopping-list) | Shopping lists with catalogs, stores, prices, taxes and a calculator | App data (catalogs shared by all lists), photos, in-page drop-downs |
| [`examples/invoice`](examples/invoice) | Invoices, quotes and receipts with templates and taxes per country | Drawing pages to SVG, PNG and a hand-written PDF; `shareFile` |
| [`examples/car-log`](examples/car-log) | Fuel log with real consumption, maintenance reminders, repairs, parts, trips | `capturePhoto`, `aiExtract` (read a fuel pump or an odometer from a photo), a public web API |
| [`examples/spreadsheet`](examples/spreadsheet) | CSV, Excel and LibreOffice sheets attached to the node | Editing attachments, a third-party library (SheetJS) |
| [`examples/viewer-3d`](examples/viewer-3d) | STL, OBJ and glTF models | three.js, `fileTypes`, a snapshot in the preview page |
| [`examples/ai-*`](examples) | Ollama, OpenAI, Groq, Claude and LiteLLM providers | [Declarative AI plugins](docs/ai-plugins.md) (no code) |

Build every example: `npm install && npm run package` inside its folder. AI plugins: `node tools/pack.mjs examples/ai-groq`.

## Repository layout

```
sdk/          docodez.d.ts (API types), docodez-dev.ts (fake API for npm run dev), picker.ts (in-page drop-down and color picker)
tools/        pack.mjs (folder → .dczp, no dependencies)
template/     the starting point
examples/     the plugins shipped with Docodez
docs/         the documentation
```

`sdk/`, `tools/` and `examples/` are copied from the Docodez repository (`scripts/sync-from-docodez.ps1`): fixes to
them are welcome here and get carried back.

## Community

- **Questions, ideas and your plugins**: [GitHub Discussions](../../discussions) — categories *Q&A*, *Ideas* and
  *Show your plugin*.
- **Bugs** in the SDK, the docs or an example: [issues](../../issues).
- Contributing: see [CONTRIBUTING.md](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md).

## License

The SDK, tools, template, examples and documentation in this repository are under the [MIT license](LICENSE): build
plugins with them, free or paid, open or closed. Docodez itself is not part of this repository.
