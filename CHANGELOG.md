# Changelog

## 0.1.2 — 2026-11-08

### 修复

- Android：`take_pending_note_file` 在移动端同样注册，启动空状态不再显示“命令未找到”提示。
- 移动端脚本把 adb / emulator 临时目录固定到项目 `.tmp/mobile`，避免系统 TEMP 权限问题。
- 移动端 `start` / `up` 把 emulator 输出写入 `.tmp/mobile/emulator.log`，启动超时会附带日志路径。
- 移除项目内 `tools/android-sdk`、`tools/android-avd`、`tools/android-home` 以及对应的 `.gitignore` 规则；Android SDK 与 AVD 改由运行者自行配置。

### 架构

- `scripts/` 脚本按类别组织：移动端（Android）命令合并为一个 `mobile` crate，以子命令提供（doctor / devices / start / up / launch / install / smoke / screenshot / reset / stop）。
- `scripts/` 其余脚本全部改为 Rust crate：`installer`（安装器构建/校验）、`release`（版本同步）、`verify`（全量验证）；npm、CI 和文档同步更新。
- 移动端脚本使用运行者自行配置的 Android SDK（`ANDROID_HOME` / `ANDROID_SDK_ROOT`），不再读取项目内 SDK；AVD 也使用用户自己的目录。
- 书库身份改为稳定 `LibraryId`：`.notes/meta.json` 与 `.note` 的 `library_meta` 保存 ID，应用数据目录的 `libraries.json` 做索引；`WorkspaceView` 返回 `id`，会话 v4，移动 Shell 只按 library id 导航，路径只作为内部位置。
- 旧库首次打开自动补 ID；复制冲突时给副本分配新 ID；标题只按 library id 持久化。
- 会话 v4 持久化无法打开的书库 `missing` 列表；启动时可重新定位或移除，不再静默丢弃。
- `workspaceStore` 当前书库只保留 `activeId`；Dockview 面板参数、活动导图、工作区激活/卸载/重命名都使用 `libraryId`；Dockview 布局 key 升到 v22，旧布局不再读取；文档/导图变更刷新优先按 library id 重新打开，前端不再直接调用 path-open wrapper。
- Board / ImportedDocument / Map 的 Tauri 命令和前端服务改为接收 `LibraryId`，由后端 registry 解析当前位置；`documentService`、`boardService`、`mapService` 不再接收 `workspaceRoot`。
- 标题改为单一真相源：新增 `rename_library`，同时更新 `.note` / `.notes` metadata 与 registry；删除前端 `library-title:<id>` 存储。
- registry 升级到 v3，条目只保留 `id/path/title`；旧格式直接冷启动。书库移动/重定位会关闭旧路径连接池。
- storage close/verify/backup、reference、search、asset 的 workspace 参数改为 `LibraryId`；删除未使用的块级 path 命令。
- `LibraryId` 收紧为 `lib_` 前缀模板类型，后端 `parse` 同步校验前缀，路径字符串无法再直接传入身份 API。
- registry 写入增加跨进程锁，并使用 `load → mutate → save` 事务，避免并发覆盖；managed library 列表改为 registry 子集。
- library 命令统一返回 `CommandError`，前端 IPC 边界可以按 code/message 分类。
- `document_commands` 拆分出 `map_commands`，导入文档和导图命令不再混在同一模块。
- 删除主题 legacy 目录迁移、插件旧前缀迁移、`migrationLedger`、旧历史文档，以及未使用的 `list_libraries` / `initialize_database` 命令。
- 明确只读书库策略：`.note` 和 `.notes` 都不支持直接打开，返回“复制到可写目录”的明确错误；删除 `persisted:false` 临时身份路径。
- 修复 Windows 目录 ReadOnly 属性被误判为不可写：可写性判断下沉到 `LibraryAccess`，`.note` 用 SQLite 写事务确认、`.notes` 用真实 `meta.json` 写入确认，不再读取目录 ReadOnly 属性，也不再对已打开的 `.note` 做写打开探测；移除前端误导性的“目录无写入权限”提示。
- bootstrap / `database_status` / `import_markdown_workspace` / `import_boards` 改为 `LibraryId`，初始化阶段不再按路径建索引。
- `documentDeleted` 事件改为携带 `libraryId`；移动端和文档库不再用 `workspaceRoot` 作为身份兜底。
- `LibraryPath` 收紧为 brand 类型，路径选择器返回值统一经过 `asLibraryPath`，普通字符串不能直接进入文件位置 API。
- 删除外观包签名与信任功能：移除签名 schema、ECDSA 校验、trusted-publisher 存储、信任按钮、作者/发布者字段、签名脚本和签名测试。
- 删除 SQLite schema migration 兼容层：移除 `schema_migrations`、migration 1–8、迁移前备份和旧库升级测试；`.note` 现在按当前 schema 一次性创建。
- 桌面窗口改为无边框自定义标题栏：删除原生白色标题栏和工具栏状态文字，最小化/最大化/关闭统一放进工具栏右侧，品牌图标改为统一蓝色。
- 文件关联从“知识库”菜单移入“设置 → 文件关联”；视图菜单改为“清空布局”；核心命令名称统一由 `commandLabels` 提供，去掉“保存”“重置布局”“使用帮助”等不一致叫法。
- 移动端改为画布优先布局：全屏导图、悬浮顶栏、悬浮视图胶囊与左侧导航抽屉；文档模式使用稳定紧凑顶栏；删除固定 `MobileHeader` / `MobileTabBar`。
- 移动端导航与控件改为有上限的流式尺寸：顶栏、按钮、字号、图标按宽度小幅放大并在平板封顶；触摸目标不小于 44dp；顶栏、正文和抽屉限制最大宽度。
- 移动抽屉的顶层名称与知识库子菜单复用桌面命令数据，补齐新建/打开/备份知识库入口，避免两端选项漂移。
- 删除移动顶栏右侧“更多”按钮，避免与侧边栏重复；搜索和看板移入“视图”子菜单。
- 移动顶栏把“打开导航”固定在左侧，返回箭头独立放在右侧；两者不再共用同一个按钮。
- 思维导图默认改为从左到右的横向树布局；新增画布右上角“整理导图布局”按钮，可忽略手动位置重新排列并持久化。
- 导图节点固定为布局高度（根节点 52、普通节点 44），使渲染后的节点中轴线与布局中心一致；不同高度节点之间连线保持水平。
- 移动端底部栏改为持久存在的“导图 / 大纲 / 文档”视图切换器；知识库管理移入侧边栏，大纲复用桌面树组件并读取当前导图。
- 移动端底部标签改为桌面式拖放：拖动时显示左/右/上/下/中心停靠区，释放后按方向创建分屏或移动已有视图，不再用“上滑固定分屏”。
- 文档标签改用“当前文档或最近打开的文档”作为回退目标，因此没有文档窗格时也能切换或拖拽分屏。
- 分屏比例按上下/左右方向分别持久化，拖动中间分隔条可在 25%–75% 范围内调整。
- 大纲树节点抽离到 `ui/outline`，桌面拖放通过适配器注入；移动端不再从 `OutlinePanel` 间接引入 Dockview 面板代码。
- 大纲拖放适配器独立为可测试模块，覆盖 note-document 与 cross-panel 两种载荷。
- 导图拖动结束时通过单个事务批量保存整张可见布局，而不是逐节点连接数据库；新增 `position_saved` 标记，`(0,0)` 不再被误判为“尚未定位”。
- 删除旧版本兼容层：不再迁移旧 `map_nodes` 根结构、不再为旧库补 `position_saved` 列、不再接受旧版移动布局存储、不再保留单节点位置命令和旧 keymap 缺省版本。
- 书库启动只读取当前数据库状态；删除旧 Markdown/board 自动导入路径，启动辅助模块改为 `libraryStatus`。
- 知识库注册表只接受当前版本；低版本或高版本都直接报错，不再静默丢弃旧注册表。
- 删除旧 `manager` 插件保留 id 和插件 SDK 缺省版本；插件 id 与版本均按当前契约严格校验。
- E2E 选择器更新到当前外观菜单、移动底部 Dock、导航抽屉、知识库菜单和文档操作菜单，完整基线 37 个通过。
- 统一模态层到 `ModalSurface`：对话框、搜索面板、移动 ActionSheet、导航抽屉和知识库管理共用遮罩、焦点陷阱、Esc 与层级栈；嵌套弹窗只关闭顶层。
- 新增 `Button` / `IconButton` / `Field` / `TextInput` / `Select` / `StateView` / `PanelShell` / `SurfaceHeader` UI 原语，并迁移主题编辑器、主题菜单、设置页、对话框、控制台、文档库、看板/导入选择器、移动导航/知识库管理/大纲/文档操作的关键控件与空状态；基础样式集中在 `primitives.css`。
- 新增 `Popover` 原语统一浮层定位、边界收拢和上翻；`ToolbarMenu` / `ContextMenu` 共用 `Popover` 与 `useDismissableLayer`，模态背景不会误关上层菜单。
- 新增 `Icon` / `PanelIcon` 原语，统一对话框关闭、移动导航/返回、控制台、面板标签、主题菜单和窗口控制图标；状态视图扩展到看板、导图、引用选择和设置空态。
- 新增 `ui/design-system` 架构说明与门禁测试：业务 `<select>` 只能通过 `Select`，原生模态禁止使用，`role="dialog"` 只允许 `ModalSurface`。
- 修复移动端导航抽屉全屏：`ModalSurface` 现在挂载到 `.app[data-shell]`，保留移动端 CSS 变量；抽屉宽度增加 `300px` fallback，并新增 E2E 宽度断言。
- 移动端移除导航抽屉的“视图”和“外观”入口；双端设置移除“外观 / 数据 / 引用”区，删除对应设置组件与主题菜单中的“外观设置…”入口。
- 移动端文档编辑态改为固定操作栏，编辑区内部滚动；格式/布局工具栏移到滚动区外的固定网格行，位于顶栏下方，并增加真实滚动位置 E2E 断言。
- 移动端悬浮 chrome 统一为同一组 token（背景、边框、圆角、阴影、模糊），顶栏 / 底栏 / 编辑工具栏 / 状态胶囊共用；编辑工具栏增加 12px 侧边距并移出滚动区，去掉底部预留遮罩，正文延伸到悬浮底栏后方。
- 移动端分屏分隔线改为透明拖拽带 + 悬浮胶囊握把 + 圆形退出按钮，去除整条边框和背景；分屏尺寸改为共享变量，焦点环改为柔和内边框。
- 修复移动端编辑态上下黑色遮罩：保存/完成移入顶栏，移除全宽操作条；文档 shell 背景与编辑区一致；格式工具栏固定偏移到顶栏下方。
- 非模态 `ViewportSelectionPanel` 从 `role="dialog"` 改为 `complementary`，架构测试禁止 `ModalSurface` 之外声明 `role="dialog"`。
- 内置 `help.note` 更新到当前 schema，并新增“布局、分屏与持久化”章节，修正“主题/外观”、菜单名称和清空布局说明。
- 统一桌面与移动端对话框：新建节点、重命名、确认和提示全部使用同一套 `Dialog`，移除 `window.prompt` 和移动端独立 DOM 对话框。
- 桌面 Dockview 在分隔条 pointerup、窗口 resize 和 pagehide 时保存布局，确保面板宽度在下次启动时恢复。
- 删除启动时无条件覆盖保存布局的 outline/map 默认宽度，恢复的 Dockview 尺寸不再被重置。
- 导图缩放/平移视口按库和导图持久化；恢复时不再无条件 fitView，面板尺寸变化也不会重置用户视口。
- Windows 启动检查 `whoami` 使用 CREATE_NO_WINDOW，避免命令行窗口一闪而过。
- `mobile up` 在应用缺失时自动安装 APK；`install` 按设备 ABI 选择 x86_64/arm64 输出，`launch` 未安装时返回明确提示。
- 不保留旧版本兼容：v3 及更早会话直接冷启动，旧 `workspace-title:<root>` 标题和旧 mobile-shell 路径状态不再读取，后端 path-open Tauri 命令已删除。

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
- 平台抽象 Phase 3（完成）：新增 `document.open/rename/delete` 与 `library.import/export` Action；移动端动作面板和桌面文档库菜单均从 `listActions()` 生成。
- 平台抽象 Phase 4（完成）：新增 `src-tauri/src/desktop.rs`、`mobile.rs`、`platform_commands.rs`；桌面窗口/单实例移入 desktop，移动端构造 `PlatformState`，新增 `platform_info`；命令层通过 `PlatformState.adapter` 取平台服务；theme 改用注入 `ThemeStore`；平台专属命令用 `#[cfg(desktop)]` / `#[cfg(mobile)]` 挂在同一个 handler。
- 平台抽象 Phase 5（大部分）：移动端空状态新增打开/新建知识库入口；managed library list/import/new-path/export；移动端导入/导出通过 SAF content URI；新增 LifecyclePort、SharePort 和 Android 系统分享；Android 工程已初始化。
- E2E 稳定性：标题工具栏用例先等待编辑器与标题可见再点击，避免 CI 冷启动超时。
- Rust 平台边界：`help_note_path` 支持 Tauri resource_dir，并保留 exe/开发目录回退。
- 移动端拆分：`MobileShell` 的文档只读视图、文档面板、文档动作面板、书库行、本机书库列表、header 和 tabbar 移入 `src/ui/mobile`。
- Phase 6（部分）：新增 390/600/768 视口 E2E 与移动端真机检查清单。
- Storage 测试在 Windows 上重试临时目录清理，避免文件锁偶发失败。
- Android：导入/导出改为通过 `tauri-plugin-fs` content resolver 读写 SAF `content://` URI。
- 移动端：`MobileRuntimeShell` 转发空状态回调；移动 DialogPort 使用紧凑 DOM 对话框，修复 Android WebView 不支持 `window.prompt` 的问题。
- Android：移动端显式创建 `main` WebView 窗口，修复 APK 启动白屏；模拟器验收通过。
- Android：launcher 图标使用应用 icon.png 生成各密度 PNG。
- 移动端：`mobileShellStore` 增加 `libraryId` 兼容映射，稳定身份到达时不重置导航。
- 测试：`opens_help_note_fixture` 使用临时副本，避免在 `resources/help.note` 旁生成 WAL/SHM。
- Android：新增 `tauri.android.conf.json`，Android identifier 使用 `com.youyou.taurinotes`（ADR-008）。
- Android：初始化 `src-tauri/gen/android`，新增手动 `android` CI workflow；arm64 debug APK 构建成功并上传 artifact。
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
- `.tnlook` 外观包、主题回退；
- 三平台 CI、单元测试、E2E 和视觉回归。
