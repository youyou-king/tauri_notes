# Changelog

## Unreleased

### 架构

- 设置入口升级为 shell 能力：核心工具栏“设置”、`settings.open`、`Ctrl/Cmd + ,`；
- 主题菜单不再拥有唯一设置入口；
- 插件管理器迁移为核心设置区 `core.plugins`，不再依赖 manager 插件；旧 `manager` id 保留兼容禁用列表；
- 删除 `src/plugins/manager`，设置窗口在插件全部失败时仍可打开；
- 新增 `src/plugins/pluginPolicy.ts`，按插件显式授权 capability；
- 新增 capability policy 测试，manifest 不能自行越权。
- 新增 E2E：禁用主题插件后仍可打开设置和插件管理器；
- 配置显式 Tauri CSP；默认启用 WebView 沙箱，保留 `TAURI_NOTES_DISABLE_SANDBOX` 回退；
- 设置 section 和 overlay 增加错误边界；初始化完成后停止文件打开轮询；
- 会话快照保存 activeMapId 和 selectedNodeId，重启后恢复选中 map/节点。
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
