# Rust crates

Rust 侧插件与内核 crate。

> 最后核对：2026-10-31 | 当前版本 v0.1.1 | 基线 133 / 38 / 33

## 布局

```text
src-tauri/crates/
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

## 职责

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

## 规则

- 桌面包 `src-tauri` 是组合根；
- kernel crate 不依赖 plugin crate；
- plugin crate 依赖 `tauri-notes-plugin-api` 和内核契约；
- 插件之间不依赖对方的实现 crate；
- Rust 命令入口只做参数包装和桌面组合，业务逻辑放在 crates；
- 修改后至少运行：

```powershell
cd src-tauri
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
```
