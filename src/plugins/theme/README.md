# Theme feature plugin

This is the first reference plugin scaffold.

Current state:

- `feature.json` declares the manifest and contribution points;
- `manifest.ts` exposes the typed manifest;
- the actual theme UI still lives in `src/ui/theme` and is not activated through the plugin host yet.

Next step:

1. create `index.ts` with `activate(context)`;
2. register theme commands, settings section, appearance packs;
3. switch the toolbar/settings to consume the registered contributions;
4. remove direct imports from the shell.
