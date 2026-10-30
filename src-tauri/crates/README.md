# Rust workspace crates

Rust-side plugin and kernel crates.

Current layout:

```text
crates/
├─ board/             tauri-notes-board
├─ content/           tauri-notes-content
├─ document/          tauri-notes-document
├─ import/            tauri-notes-import
├─ workspace/         tauri-notes-workspace
├─ plugin-api/        tauri-notes-plugin-api
├─ plugin-runtime/    tauri-notes-plugin-runtime
├─ platform/          tauri-notes-platform
├─ storage/           tauri-notes-storage
└─ theme/             tauri-notes-theme
```

Implemented:

```text
plugin-api
├─ PluginManifest
├─ PluginKind
├─ validate_manifest
└─ manifest validation tests

plugin-runtime
├─ plan_activation
├─ dependency ordering
└─ duplicate / missing / cycle detection

platform
├─ PlatformAdapter
├─ NativePlatform
├─ SystemTheme
└─ directory / file association implementations

storage
├─ sqlite connection / path helpers
├─ schema migrations
└─ database status / backup

content
├─ reference target lookup
├─ reference preview / relink
└─ image asset storage

board
├─ board summaries / read
├─ board save
└─ board delete + reference cleanup

document
├─ markdown block parser
├─ imported documents / blocks / tree
├─ block save / preview / index
├─ mind maps / outline
└─ map nodes / document binding

import
├─ markdown workspace import
└─ legacy board import

workspace
├─ workspace / .note open
├─ document read / index
├─ block edit operations
└─ file and database search

theme
├─ custom theme list / save / delete
├─ theme id validation
└─ legacy theme migration
```

Planned:

```text
crates/
├─ platform/          PlatformAdapter
├─ plugin-runtime/    lifecycle + registry
└─ plugins/           board / reference / import / viewport / theme
```

Rules:

- the desktop package (`src-tauri`) is the composition root;
- kernel crates do not depend on plugin crates;
- plugin crates depend on `tauri-notes-plugin-api` and kernel contracts;
- plugins must not depend on each other's implementation crates.
