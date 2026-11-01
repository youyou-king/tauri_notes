# ADR-007：配置、状态与内容的序列化边界

## 状态

已接受，待随 Action / Keymap 实施落地。

## 背景

项目里出现多种“配置”：

- 用户可编辑的快捷键；
- 应用默认设置；
- 会话恢复状态；
- Dock 布局；
- 插件 manifest；
- 主题包；
- 备份清单；
- `.note` 内容数据库。

这些数据的生命周期、编辑者和机器可读性不同。如果统一用一种格式，会在某些场景变好、在另一些场景变差：

- JSON 是 WebView、Tauri IPC、`localStorage`、IndexedDB 和 TypeScript 的原生数据格式，适合机器生成和嵌套结构，但不支持注释，手写快捷键配置可读性一般；
- TOML 适合人类手写配置，支持注释、表结构和清晰的键值分组，但不适合作为 WebView 运行时状态和复杂嵌套对象的通用传输格式；
- SQLite 是内容真相，不应该被配置文件替代。

因此问题不是“JSON 过时”或“TOML 更现代”，而是**不同数据应该使用不同的序列化边界**。

## 决策

### 1. 内容：继续使用 SQLite

`.note` 中的文档、块、引用、导图、看板和 FTS 继续以 SQLite 为唯一真相。

配置文件不进入 `.note`，避免把用户级设置和知识库内容耦合。

### 2. 人类手写配置：TOML

以下文件使用 TOML：

```text
keymap.toml                 用户快捷键覆盖
resources/keymap/default.toml 内置默认绑定（编译期嵌入）
config/app.default.toml     应用默认设置（未来）
```

原因：

- 用户会直接阅读、复制、备份和修改；
- 注释可以解释每个 action 和冲突；
- 数组表 `[[bindings]]` 比 JSON 的嵌套数组更适合逐条编辑；
- 不需要在配置里表达 `null`、`undefined` 等 JavaScript 语义。

示例：

```toml
version = 2

[[bindings]]
action = "search.open"
platform = "desktop"
key = "p"
ctrl = true

[[bindings]]
action = "search.open"
platform = "mac"
key = "p"
meta = true

[[bindings]]
action = "search.open"
platform = "mobile"
surface = "header-button"
```

### 3. 机器生成与运行时状态：JSON

以下数据继续使用 JSON：

```text
session.json               会话恢复
dock-layout.json           Dock 布局
app-state.json             会话/布局等机器状态的合并快照（可选）
keymap.resolved.json       运行时解析后的 keymap（可选缓存）
plugin.manifest.json       插件契约与构建产物
backup.manifest.json       备份清单
localStorage / IndexedDB   WebView 本地状态
Tauri IPC                  前后端传输
```

原因：

- WebView、Tauri IPC 和 TypeScript 天然使用 JSON；
- 这些数据由程序生成，不需要注释；
- 需要任意嵌套、可选字段和快速序列化；
- 便于使用 JSON Schema、类型生成和浏览器调试工具。

### 4. 同一份数据只能有一个规范格式

不允许同时维护：

```text
keymap.toml
keymap.json
```

作为两个同等权威的来源。否则会出现“改了 TOML 但运行时读 JSON”的问题。

规则：

- TOML 是 hand-authored 配置的 canonical source；
- 运行时读取后转换成 JSON 内存对象；
- 如果需要缓存，缓存文件放在 `state/`，且可随时删除重建；
- 用户覆盖只写 `keymap.toml`，不写第二份 JSON 覆盖文件。

### 5. TOML 由 Rust 配置服务读写

前端不直接引入 TOML 解析器，避免 WebView 和 Rust 两侧解析行为不一致。

```text
UI
  → Tauri command load_keymap / update_binding / reset_keymap
  → Rust config service
  → toml_edit（保留注释和格式）
  → keymap.toml
  → 返回解析后的 JSON 给前端
```

Rust 侧建议：

- 读取默认 TOML 与用户 `keymap.toml`；
- 合并后做冲突检测；
- 写回用户文件时使用 `toml_edit`，只修改目标 binding，保留用户注释；
- 返回 `KeymapProfile` 的 JSON 视图给前端。

如果未来需要支持纯 Web 开发模式，可以在测试/开发环境提供 JSON fixture，但生产路径仍以 Rust 配置服务为准。

### 6. 插件 manifest 暂保持 JSON

插件 manifest 是契约数据，不是用户日常编辑的配置：

- 当前由构建期打包并由 kernel 校验；
- 与 TypeScript 类型、JSON Schema、插件 SDK 版本检查绑定；
- 改成 TOML 会增加构建期转换和运行时解析分支。

因此：

- `plugin.manifest.json` 继续作为规范和构建产物；
- 如果未来要改善插件作者体验，可以增加 `plugin.toml` **源文件**，构建时转换成 JSON 产物，但运行时只读 JSON；
- 不在运行时同时支持两种 manifest 格式。

### 7. 主题包继续使用 JSON

`.tnlook` 是数据包，不是手写配置：

- 由主题编辑器生成；
- 内部使用 JSON 表达 token、资源和 variant；
- 进入 zip 后由主题运行时读取。

主题作者如果需要注释，应在文档中说明，而不是把主题包改成 TOML。

## 结果

优点：

- 用户快捷键配置可读、可注释、可版本控制；
- 运行时和 IPC 继续使用 WebView 原生 JSON；
- 配置与状态分离，备份策略更清晰；
- 不会出现两份配置互相覆盖；
- 未来可以把 `settings.toml` 纳入同一套 Rust 配置服务。

代价：

- 需要 Rust TOML 读写与 `toml_edit`；
- 需要处理 TOML 的注释保留和格式稳定性；
- 前端需要通过 Tauri 命令读写 keymap，不能直接 `fetch` 一个 JSON；
- 需要为 TOML 配置增加 schema 校验和迁移版本。

## 替代方案

### 全部使用 JSON

优点是工具链最简单，缺点是用户手写快捷键体验差，不能注释，冲突说明只能放在外部文档。

### 全部使用 TOML

优点是配置统一，缺点是会话、Dock 布局、插件 manifest、IPC 都不适合 TOML，且 WebView 需要额外解析器。

### YAML

不采用。缩进敏感、隐式类型多，错误提示和移动端编辑体验不如 TOML。

### SQLite 存所有设置

不采用。设置需要可导出、可 diff、可手工编辑；SQLite 不适合作为用户配置的编辑界面。