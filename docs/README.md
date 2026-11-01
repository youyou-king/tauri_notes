# 设计文档索引

> 更新：2026-11-01  
> 当前版本：Tauri Notes v0.1.1  
> 当前实现：Tauri 2 + React 19 + Tiptap/ProseMirror 全块编辑器 + SQLite `.note`。  
> 发布记录：<https://github.com/youyou-king/tauri_notes/releases>

## 当前文档

| 文件 | 角色 | 状态 |
| --- | --- | --- |
| [技术架构与插件化方案](技术架构与插件化方案.md) | 内核 + 功能/能力/数据插件、Tauri 分层、平台移植、耦合治理 | **已实施，持续维护** |
| [插件化实施记录](插件化实施记录.md) | 当前状态摘要与验证基线 | **当前维护记录** |
| [插件化实施记录（历史）](插件化实施记录-历史.md) | 各阶段实际完成内容与历史基线 | 历史归档 |
| [ADR 索引](adr/README.md) | 已落地的架构决策与边界 | **已实施** |
| [重构验收报告](重构验收报告.md) | 重构项完成度、验证基线与发布状态 | **当前验收** |
| [状态架构契约](状态架构契约.md) | 状态所有权、单一数据源、派生快照、迁移顺序 | **已实施** |
| [全块编辑器架构](全块编辑器架构.md) | 单 Tiptap 实例、12 列块布局、SQLite 块存储、导入与视口 | **已实施，持续维护** |
| [布局架构](布局架构.md) | AppShell / 面板 / 编辑区的尺寸与滚动契约 | **面板与编辑器均已更新** |
| [视口方案](视口方案.md) | 跨文档引用、对照板、打包布局 | **已实施；内容真相为 SQLite** |
| [IME 验收](IME验收.md) | 真实中文输入法、表格、任务列表验收清单 | **保留；真实 IME 仍需人工确认** |
| [设计](设计.md) | 产品蓝图：知识库、导图、节点、画布 | **产品方向参考** |
| [示例主题](示例主题.theme.json) | 自定义主题示例 | **可用** |

## 工程文档

| 文件 | 角色 |
| --- | --- |
| [贡献指南](../CONTRIBUTING.md) | 开发环境、架构边界、插件规则、状态规则、验证与发布 |
| [架构审视与改进计划](架构审视与改进计划.md) | 发现登记、P0/P1/P2 优先级、分阶段任务和 fitness functions |
| [输入与移动端架构审计](输入与移动端架构审计.md) | Action / Input Router / keymap 与移动端体验一致性审计 |
| [平台抽象与移动端重构方案](平台抽象与移动端重构方案.md) | 运行时组合根、Shell、端口、Action 与 Rust 平台边界的定制方案 |
| [系统架构审计](系统架构审计.md) | 数据访问、持久化、契约、移动端目标与备份审计 |
| [ADR-007](adr/ADR-007-config-format-boundaries.md) | 配置用 TOML、运行时状态用 JSON、内容用 SQLite |
| [主题插件](主题插件.md) | 主题运行时、`.tnlook`、签名与测试 |
| [Rust crates](Rust-crates.md) | Rust workspace 结构、职责和依赖规则 |

## 已清理文档

以下历史文档已删除，不再作为新实现依据：

- `迁移方案.md`：CodeMirror 6 迁移，已被 Tiptap 全块编辑器取代；
- `实施计划.md`：CodeMirror 迁移阶段与验收；
- `redme.md`：Bevy 块编辑器技术设计；
- `布局方案.md`：Bevy / bevy_lunex 布局提案；
- `css.md`：Bevy / bevy_flair 主题提案。

## 当前结论

1. **当前编辑器是单 Tiptap/ProseMirror 实例**，块是文档节点，不是独立编辑器。
2. **SQLite 是内容真相**：`.note` 单文件保存块元数据与每块 `content_json`。
3. **Markdown 是导入语法和导出目标**，不是持久化真相。
4. **Dockview + React Flow + CSS Token** 是当前面板、导图和主题基础。
5. **浅色主题采用暖中性色**，Dockview 随主题切换 `themeLight` / `themeAbyss`。
6. **状态层已收敛**：
   - 编辑器：`useEditorField` 按 `selectedBlock` / `toolbar` / `stats` 字段订阅；
   - 主题：`useBaseThemeTokens` 管理 base token，appearance pack 管理 overlay（ADR-006）；
   - 工作区：`activeRoot` + `selectActiveWorkspace` 派生当前工作区；
   - 面板：活动 map/blockdoc 同步选中状态，session 恢复 activity panel，文档脏状态上报 `usePanelStore`。
7. **设置入口属于 shell**：核心工具栏“设置”、`settings.open` 和 `Ctrl/Cmd + ,`；主题菜单只是另一个入口；插件管理器是核心设置区 `core.plugins`。
8. **验收基线**：
   - 前端单元测试 216 个；
   - Rust 单元测试 48 个；
   - Playwright E2E / 视觉回归 37 个；
   - 安装包载荷、解包流程已在 Windows CI 验证；
   - 真实中文 IME 仍需在目标输入法环境人工确认。
9. **首次启动不自动打开示例**：没有会话时保持空工作区，通过“知识库”菜单新建或打开。
10. **顶部“帮助”按钮**打开内置使用帮助知识库，源文件为 `resources/help.note`。
11. **“控制台”面板**记录命令、知识库、面板、文档、主题和异常，可复制和清空。
12. **安装器、应用和卸载器使用 `asInvoker`**，不请求管理员权限；默认只写入用户选择的安装目录，系统集成仅在用户勾选时创建。
13. **发布物不进入 Git**：安装包作为 GitHub Releases 资产发布，源码仓库不保存二进制。
14. **使用帮助**：`help.note` 已补充回收站、数据校验与备份、设置入口；可从顶部“帮助”打开。
15. **移动端当前是响应式 compact Shell，不是原生目标**：Android/iOS 工程尚未初始化；Runtime + Shell 的 Phase 1 已落地，Library/Dialog/DocumentActions/WorkspacePresenter/Navigation 端口已落地，document rename/delete Action 与 Rust 入口拆分已落地；完整顺序见 [平台抽象与移动端重构方案](平台抽象与移动端重构方案.md)。
16. **远程笔记/多端同步**：列为待讨论，不进入当前平台重构范围；约束和待决策项见方案第 19 节。

## 文档维护规则

- 项目只保留根 `README.md` 和本索引两个 README；
- 模块说明放到本目录的专题文档，不再为源码目录创建 README；
- 当前实现变化时，优先更新 `状态架构契约`、`插件化实施记录`、`全块编辑器架构`、`平台抽象与移动端重构方案` 和根 `README.md`；
- 历史验证记录中的测试数字保留当时基线，不作为当前门禁；当前基线以根 `README.md` 和 `重构验收报告` 为准；
- 架构与插件契约变化时，同步更新 `技术架构与插件化方案` 和根 `CONTRIBUTING.md`；
- 发布新版本时同步更新版本号、`CHANGELOG.md` 和 `重构验收报告`。

## 本次清理

- `架构重构方案.md`：已完成，内容并入 ADR、计划与验收报告；
- `插件化实施手册.md`：旧 Rust 路径映射，已过时；
- `界面设计.md`：Bevy 阶段交互参考，已由当前布局与编辑器文档替代。
