# `docodez-plugin.json` and the `.dczp` package

## The package

A plugin is distributed as a **`.dczp`** file: a ZIP archive with `docodez-plugin.json` at its root (or inside a
single top-level folder — what "compress this folder" produces). MIME type: `application/x-docodez-plugin`. A plain
`.zip` with the same content is accepted too.

Build one with [`tools/pack.mjs`](../tools/pack.mjs) (Node 22+, no dependencies):

```sh
node tools/pack.mjs path/to/dist [output-folder]   # → <output>/<id>-<version>.dczp (default output: ./out)
```

Every example and the template have `npm run package` (build + pack).

### What Docodez checks before installing

| Rule | |
|---|---|
| Manifest | `docodez-plugin.json` present and valid JSON. |
| `id` | Lowercase letters, digits, `.`, `-`, `_`; starts with a letter or digit; 2 to 64 characters. |
| `name` | Required. |
| `version` | Numbers separated by dots, 1 to 4 parts (`1`, `1.2`, `1.2.0`, `1.2.0.7`). |
| `apiVersion` | Not higher than the API of that Docodez (otherwise: "needs a newer Docodez"). |
| Entry page | `entry` exists in the package (except AI-only plugins). |
| Paths | No absolute paths, no `..`, no drive letters. |
| Size | At most 200 MB uncompressed and 10 000 files. |

Invalid optional fields are dropped instead of failing (a missing icon, a bad category, an empty translation).

## Fields

```json
{
  "id": "me.shopping",
  "name": "Shopping List",
  "version": "1.2.0",
  "description": "A shopping list in a node...",
  "i18n": {
    "es": { "name": "Lista de compras", "description": "Una lista de compras en el nodo..." },
    "fr": { "name": "Liste de courses", "description": "..." }
  },
  "category": "productivity",
  "author": "Your name",
  "homepage": "https://github.com/you/shopping",
  "entry": "index.html",
  "icon": "icon.svg",
  "apiVersion": 2,
  "fileTypes": [".csv"]
}
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique and permanent: **nodes store it**, so changing it orphans every node made with the plugin. Use `author.name`. |
| `name` | yes | Display name, in **English** (used when there is no translation for the user's language). |
| `version` | yes | Compared number by number: `1.10.0` > `1.9.3`. Bump it on every release: catalogs offer *Update* when it grows. |
| `description` | no | One or two sentences, in English. Shown in the plugin list and the install prompt. |
| `i18n` | no | Translations of `name` and `description`, keyed by two-letter language code (`es`, `fr`...). Your page gets the user's language in `context.language` for its own texts. |
| `category` | no | Where it is listed. Known: `ai`, `productivity`, `viewers`, `tools`, `games` (shown with an icon and a translated name). Any other short lowercase word (letters, digits, `-`, max 32) is shown as is. Without it: `ai` for AI plugins, otherwise `other`. |
| `author` | no | Shown in the install prompt and the catalog. |
| `homepage` | no | Your project page. |
| `entry` | no | The page that opens in the node. Default `index.html`. |
| `icon` | no | PNG or SVG. It is also the icon of your nodes in the tree. SVGs are drawn by Docodez's own renderer: `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon` and `g`, with fill, stroke, opacity, `style` and `transform`. **No gradients, no text.** A 24×24 `viewBox` with simple shapes works best. |
| `apiVersion` | no | Minimum API your plugin needs (default 1). See [API versions](api.md#versions-and-feature-detection). |
| `fileTypes` | no | Extensions your plugin can open (`[".stl", ".obj"]`). When creating a node of your plugin, the user can start from such a file; it becomes an attachment of the node. |
| `ai` | no | Makes the plugin an **AI provider**. See [AI plugins](ai-plugins.md). |

## The node (for the curious)

A plugin node is an HTML node with a special format. It keeps your plugin's `id` and the version it was saved with,
your data (`setData`), your preview page (`setPreview`) and the attachments. When the plugin is missing, Docodez shows
the preview page and offers to install it; removing a plugin never touches the nodes.
