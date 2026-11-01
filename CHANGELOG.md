# Changelog

## Unreleased

### 架构

- 设置入口升级为 shell 能力：核心工具栏“设置”、`settings.open`、`Ctrl/Cmd + ,`；
- 主题菜单不再拥有唯一设置入口；
- 插件管理器迁移为核心设置区 `core.plugins`，不再依赖 manager 插件；旧 `manager` id 保留兼容禁用列表；
- 删除 `src/plugins/manager`，设置窗口在插件全部失败时仍可打开；
- 新增 `src/plugins/pluginPolicy.ts`，按插件显式授权 capability；
- 新增 capability policy 测试，manifest 不能自行越权。
- 仓库根目录整理：`help.note` → `resources/help.note`，`e2e.html` → `e2e/fixtures/e2e.html`；`.gitignore` 补齐构建与缓存产物。
- 新增输入与移动端架构审计：Action / Input Router / keymap 与移动端导航建议。
- 新增系统架构审计：数据访问、持久化、契约、移动端目标与备份。
- 新增 ADR-007：人类手写配置用 TOML，运行时状态用 JSON，内容用 SQLite。
- 新增 `docs/平台抽象与移动端重构方案.md`：运行时组合根、Shell 组合、平台端口、Action 与 Rust 平台边界。
- 平台抽象 Phase 1：新增 `src/runtime`、`DesktopShell`、`MobileRuntimeShell`；`App` 不再直接选择壳层，移动端不再渲染桌面工具栏。
- 平台抽象 Phase 2：新增 `LibraryPort`、`DialogPort`、`DocumentActionsPort`、`WorkspacePresenter`、`NavigationPort`；`useWorkspaceOpen` 不再直接使用文件对话框或 dockRef；快捷键导入/导出对话框移入 application 服务；移动端重命名/删除不再直接调用 documentService。
- 平台抽象 Phase 3（大部分）：新增 `document.open` / `document.rename` / `document.delete` Action；移动端动作面板、桌面文档库按钮、右键菜单和 F2 统一走 Action。
- 平台抽象 Phase 4（部分）：新增 `src-tauri/src/desktop.rs`、`mobile.rs`、`platform_commands.rs`；桌面窗口/单实例移入 desktop，移动端构造 `PlatformState`，新增 `platform_info`；命令层通过 `PlatformState.adapter` 取平台服务；theme 改用注入 `ThemeStore`。
- 平台抽象 Phase 5（部分）：移动端空状态新增打开/新建知识库入口；新增 managed library list/import/new-path；移动端打开外部 `.note` 时复制到 App 私有书库，新建时先输入标题；移动端“目录”页新增本机书库列表；导出和 Android 工程未落地。
- 文档同步：明确移动端当前是响应式 compact Shell，原生 Android/iOS 工程尚未初始化。
- 记录“远程笔记/多端同步”为待讨论项，不进入当前平台重构范围。
- 输入层重构：Action Registry / Input Router、移动端 surface action、mobileShellStore、`keymap.toml` 读写；命令不再携带 shortcut。
- 设置新增快捷键面板：查看、录制重设、恢复默认，保存后热更新；`keymap.toml` 写回保留注释。
- 删除未使用的 Intent 总线，contextmenu 屏蔽保留在 shell。
- SQLite 每个 workspace 使用连接池，迁移进程内只执行一次；卸载 workspace 时关闭连接池。
- 编辑器快照按 `EditorState` 缓存，避免同一 transaction 多订阅重复全量计算。
- 移动端增加返回栈和“返回”按钮，保留 tab/document 导航历史。
- 移动端文档列表支持长按/右键/左滑动作面板，并支持滑动返回。
- 统一 keymap 状态，桌面工具栏根据有效绑定显示 shortcut hint；支持快捷键 TOML 导入/导出。
- 内置默认 keymap 资源化为 `resources/keymap/default.toml`，编译期嵌入并由 Rust 返回。
- 新增 E2E：禁用主题插件后仍可打开设置和插件管理器；
- 配置显式 Tauri CSP；默认启用 WebView 沙箱，保留 `TAURI_NOTES_DISABLE_SANDBOX` 回退；
- assetProtocol 静态 scope 改为空，打开工作区时动态授权对应目录；
- NSIS 安装模型从 `perMachine` 改为 `currentUser`，与自定义安装器 `asInvoker` 对齐；
- 新增 `scripts/version.mjs`，以 package.json 为版本源同步 tauri/Cargo，并在 CI 检查；
- schema 升级前自动备份数据库，备份名包含版本、进程和时间戳；
- 面板状态增加 idle/dirty/saving/saved/error，保存流程写入生命周期；
- Dockview 标签关闭 dirty 文档时弹出放弃确认；
- 打开类事件收口为 typed `APP_EVENTS` / `emitAppEvent` / `onAppEvent`；
- 新增标签关闭确认单元测试（关闭/确认/取消）；
- 新增 tag release workflow：Windows 自定义安装器、macOS dmg、Linux AppImage/deb；
- 贡献点强制使用插件 id 命名空间，阻止跨插件覆盖；
- 重置布局、卸载工作区、打开帮助/单文件统一 dirty 确认，避免绕过标签关闭；
- 文档保存、重命名、删除、打开块文档等事件收口到 typed `APP_EVENTS`；
- 大纲、地图、应用级地图刷新和嵌入事件完成迁移，应用事件不再使用裸字符串；
- 会话快照升级到 v2，加入 legacy `active` → `activeRoot` 迁移和版本保护；
- 新增事件 registry 唯一性和裸字符串扫描 fitness test；
- 新增共享 `shellActions`，桌面、移动和插件统一走同一能力入口；
- 主题选择升级为 versioned envelope，兼容 legacy 裸字符串；
- IPC 边界统一 `TauriCommandError`，区分权限、未找到和一般失败；
- 备份创建后执行 `PRAGMA integrity_check`，损坏备份直接失败；
- 新增 release workflow / Tauri bundle 配置的静态就绪测试；
- 移动 shell 补齐搜索、帮助、看板、主题入口，统一走 `shellActions`；
- appearance IndexedDB 升级到 v2，新增 meta/schemaVersion 迁移；
- 设置页新增数据维护：校验数据库、创建备份；
- 内置 UI renderer 增加 typed props contract；
- 插件命令 context 收窄为 typed `PluginCommandContext`；
- session / theme 共用 typed migration runner，DATA-02 关闭；
- Tauri capability 拆分为 core / window / dialog，全部显式绑定 main；
- 数据 schema 升级到 v7，文档删除改为软删除，设置页新增回收站恢复；
- 文档库删除后提供撤销按钮；
- storage 命令返回结构化 `CommandError`，前端解析 code/message；
- 明确 ThemeProvider 与 appearance pack 的 token 所有权，避免互相覆盖；
- 实施记录拆分为当前摘要和历史归档；本地 `verify:all` 构建/安装器验证通过。
- 设置 section 和 overlay 增加错误边界；初始化完成后停止文件打开轮询；
- 会话快照保存 activeMapId 和 selectedNodeId，重启后恢复选中 map/节点；
- 工作区选择改为原子 `select(mapId, node)`，移除单独写 activeMapId 的入口；
- 核心插件管理区增加注册/启用/禁用/异常/依赖阻塞汇总；
- 插件命令与核心命令冲突时记录 owner 和 warning，不再静默跳过。
- 插件注册表从 `PluginProvider` 抽离到 `src/plugins/registry.ts`；
- 插件注册失败进入 diagnostics，不再打断组合根；
- 插件依赖激活失败时阻断依赖方，并记录 `blockedBy`。

### 文档

- 新增 `docs/架构审视与改进计划.md`，登记安全、插件运行时、状态、迁移和发布风险；
- 将 `设计文档/` 移入仓库 `docs/`；
- 移除 4 个模块 README，模块说明合并到 `docs/主题插件.md`、`docs/Rust-crates.md` 和 `CONTRIBUTING.md`；
- 仓库只保留根 `README.md` 和 `docs/README.md` 两个 README。

## 0.1.1 — 2026-10-31

### 状态架构

- 编辑器工具栏、选中块、文档统计统一由 `EditorSnapshot` 派生；
- 删除 `selectedBlock` / `stats` React state 镜像与手工同步；
- 主题外观包改为 `appearanceRuntime`，完整保存 dark/light variant 与资源；
- 工作区当前项改为 `activeRoot` + `selectActiveWorkspace` 派生；
- Dockview 活动地图/文档面板同步 `activeMapId` 与 `selectedNode`；
- 文档面板脏状态重新接入 `usePanelStore`。

### UI 与文档

- 统一顶部导航栏模板与下拉收起行为；
- 统一编辑器选区样式，移除选中块胶囊与重复描边；
- 修复块编辑器 Grid 行被最小高度拉伸造成的空隙；
- 更新 README、插件文档、状态契约和验收报告；
- 删除确认无引用的旧外观资源写入函数。

### 发布

- Windows x64 安装包作为 GitHub Release 资产发布，不进入 Git 历史；
- 安装包附带 `SHA256SUMS.txt`。

## 0.1.0 — 2026-10-31

- 首个公开发布；
- Tauri 2 + React 19 桌面应用；
- 知识库、导图、文档编辑、看板、搜索、导入；
- `.tnlook` 外观包、签名信任、主题回退；
- 三平台 CI、单元测试、E2E 和视觉回归。
