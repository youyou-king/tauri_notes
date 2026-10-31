# Changelog

## Unreleased

### 架构

- 设置入口升级为 shell 能力：核心工具栏“设置”、`settings.open`、`Ctrl/Cmd + ,`；
- 主题菜单不再拥有唯一设置入口；
- 插件管理器 `manager` 设为保留插件，不能被禁用；
- 新增 E2E：禁用主题插件后仍可打开设置和插件管理器。

### 文档

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
