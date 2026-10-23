# Contributing

Thanks for helping! This repository holds the plugin SDK, its documentation, a template and the plugins that ship with
Docodez.

## Ways to help

- **Ask and answer** in [Discussions → Q&A](../../discussions).
- **Share your plugin** in *Show your plugin*: others learn from it, and it can be listed in the community catalog.
- **Propose** API additions or plugin ideas in *Ideas*. Explain the use case: the API grows from real needs.
- **Report bugs** in the SDK, the docs or an example with an [issue](../../issues/new/choose).
- **Fix things** with a pull request.

## Pull requests

1. Open an issue or discussion first for anything bigger than a typo, so we agree on the approach.
2. Keep the change focused. Match the style of the surrounding code.
3. Build what you touched: `npm install && npm run package` in each changed example or the template (CI does it too).
4. Docs in English, plain and short. Code comments in English for new code (some examples have Spanish comments: they
   came from the Docodez repository; translating them is welcome).
5. API changes (`sdk/docodez.d.ts`) must match what Docodez implements: they are made in Docodez first and synced here.

## Example plugins

Changes to `examples/` and `sdk/` are carried back to the Docodez repository (they ship with the app). Bump the
plugin's `version` when you change its behavior.

## License

By contributing you agree that your contribution is licensed under the [MIT license](LICENSE) of this repository.
