# Publishing a plugin

There are three ways a plugin reaches users today, and a fourth one is planned.

## 1. Share the `.dczp` file

Anyone can install a `.dczp`: double-click it on Windows, *Open with → Docodez* on Android, or *Plugins... → Install a
package*. Docodez shows its name, version, author and description before installing, and warns when it replaces a newer
version. Attach the file to a GitHub release of your project, for example.

## 2. A Docodez Web server's catalog

Every Docodez Web server has a plugin catalog. Its administrator uploads packages on the **`/_admin`** page (*Plugins →
Upload or replace*), or with the API:

```sh
curl -X POST https://docodez.example.com/api/plugins \
  -b "session cookie of an administrator" \
  --data-binary @out/yourname.myplugin-1.0.0.dczp
```

Then:

- **Docodez Web** users of that server use the plugin directly (nothing to install);
- **desktop and Android** users connect to the server in *Plugins...* and get *Install* / *Update* buttons.

The catalog API is public for reading: `GET /api/plugins` (list), `/api/plugins/{id}` (one), `/api/plugins/{id}/package`
(the `.dczp`), `/api/plugins/{id}/icon`.

## 3. Pull request to this repository

A plugin that is useful to many people can become an example here (and ship with Docodez): open a discussion in
*Show your plugin* first, then a pull request with the source under `examples/`.

## 4. Community catalog (planned)

A public catalog of community plugins, browsable from inside Docodez, is planned. Until it exists, share your plugin in
the *Show your plugin* discussion category so people can find it — and so it can be listed when the catalog opens.

What the catalog will probably require (so you can prepare):

- the source code public (a link in `homepage`), and a license;
- a unique `id` with your name as prefix;
- English `name` and `description` (translations welcome);
- following the [guidelines](guidelines.md), especially privacy.

## Security

A plugin is code that runs inside Docodez and sees the data of its own node. Users and administrators should only
install plugins they trust. Docodez isolates plugins (one node each, a local server reachable only from the device, a
sandboxed iframe on the web), but it cannot tell a careful plugin from a careless one: be the careful one.
