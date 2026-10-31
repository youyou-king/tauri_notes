# Tauri Notes

![CI](https://github.com/youyou-king/tauri_notes/actions/workflows/ci.yml/badge.svg)

[![Latest Release](https://img.shields.io/github/v/release/youyou-king/tauri_notes)](https://github.com/youyou-king/tauri_notes/releases/latest)

Tauri 2 + React 19 的本地优先 Markdown 知识库。

最新安装包发布在 GitHub Releases，不提交到 Git 仓库：

```text
https://github.com/youyou-king/tauri_notes/releases
```

变更记录见 [`CHANGELOG.md`](CHANGELOG.md)，开发规则和目录约定见
[`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 当前架构

- `.note` 单文件知识库：SQLite + WAL；
- 块级 Markdown 文档：Tiptap / ProseMirror 编辑，前端按块虚拟化；
- Dockview 面板：大纲、文档、导图、对照板、控制台、文档库；
- React Flow 导图；
- SQLite 搜索；
- 深色 / 浅色 / 跟随系统 / 自定义主题；
- `.tnlook` 外观包：预览、应用、签名信任、dark/light variant 切换；
- 编辑器、主题、工作区和面板状态按单一数据源收敛；
- 顶栏“设置”是 shell 入口，插件管理器不依赖主题插件；
- Windows 安装器、卸载器和 `.note` 文件关联。

架构说明：

- [`docs/README.md`](docs/README.md) — 完整文档索引
- [`docs/架构审视与改进计划.md`](docs/架构审视与改进计划.md) — 风险、优先级与分阶段计划
- [`docs/架构重构方案.md`](docs/架构重构方案.md)
- [`docs/技术架构与插件化方案.md`](docs/技术架构与插件化方案.md)
- [`docs/状态架构契约.md`](docs/状态架构契约.md)
- [`docs/重构验收报告.md`](docs/重构验收报告.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — 开发与插件规范

## 技术栈

- Tauri 2 + Rust
- React 19 + TypeScript
- Vite 6
- Tiptap / ProseMirror
- Dockview
- React Flow
- SQLite / sqlx
- Zustand

## 运行

```powershell
cd tauri_notes
npm install
npm run tauri dev
```

首次启动不自动打开示例知识库；无知识库时显示空工作区，可通过“知识库”菜单新建或打开。带 `.note` 参数启动时会直接打开该文件。

顶部“帮助”按钮会打开内置 `help.note` 使用帮助知识库。

顶部“设置”按钮或 `Ctrl/Cmd + ,` 打开设置；插件管理在“设置 → 插件”中。

只运行前端：

```powershell
npm run dev
```

开发版和正式版都不请求管理员权限。

## 验证

```powershell
npm run check        # TypeScript + 173 个前端单元测试
npm run e2e          # 35 个 Playwright E2E / 视觉回归
cd src-tauri
cargo test -p tauri-notes --lib

# Rust crates
cargo test -p tauri-notes-plugin-api --lib
cargo test -p tauri-notes-plugin-runtime --lib
cargo test -p tauri-notes-platform --lib
cargo test -p tauri-notes-storage --lib
cargo test -p tauri-notes-content --lib
cargo test -p tauri-notes-board --lib
cargo test -p tauri-notes-document --lib
```

完整验证和打包：

```powershell
npm run verify:all
```

CI 工作流：

```text
.github/workflows/ci.yml
```

矩阵：

```text
frontend: ubuntu
e2e: ubuntu
rust-crates: Windows / macOS / Ubuntu
desktop-build: Windows / macOS / Ubuntu
```

`desktop-build` 执行：

```text
npm ci
npm run tauri build -- --no-bundle
```

Linux 安装 WebKitGTK / appindicator / rsvg / patchelf 依赖。

重构验收与剩余事项见：

- [`docs/重构验收报告.md`](docs/重构验收报告.md)
- [`docs/状态架构契约.md`](docs/状态架构契约.md)

## 外观包签名

`.tnlook` 支持可选 ECDSA P-256 发布者签名：

- 签名覆盖 `appearance.json`（含 integrity 清单）；
- 导入时校验签名；
- 未信任的发布者需在导入面板确认；
- 签名脚本：

```powershell
node scripts/sign-appearance-pack.mjs appearance.json private-key.pem "发布者名称"
```

生成后的 `appearance.json` 重新打包为 `.tnlook` 即可。

## 主要目录

```text
tauri_notes/
├── src/
│   ├── app/                 # 工具栏、导航、工作区用例、文档事件
│   ├── application/         # 服务、端口、Zustand store
│   ├── components/          # DockWorkspace、导图、搜索
│   ├── domain/              # 文档、块、对照板领域模型
│   ├── infrastructure/      # Tauri IPC / 仓储
│   ├── prototype/           # 生产使用的块编辑器扩展
│   ├── ui/                  # 面板、主题、设计系统、导入预览
│   └── styles.css           # 组件与主题样式
├── src-tauri/
│   ├── admin.manifest       # Win32 应用清单（asInvoker）
│   ├── src/commands/        # Tauri 命令入口
│   ├── src/services/        # 应用服务
│   └── src/*_store.rs       # SQLite 仓储
├── docs/                    # 设计文档、状态契约、专题文档
├── CONTRIBUTING.md          # 开发与插件规范
├── CHANGELOG.md             # 版本变更
├── help.note                # 内置使用帮助知识库
├── e2e/                     # Playwright 冒烟与视觉回归
├── installer/custom/        # 安装器 / 卸载器 C# 源码
└── scripts/                 # 构建与验证脚本
```

## 编辑器

- 文档按块虚拟化，只挂载视口附近的块；
- 标题、段落、列表、引用、代码、表格、分割线；
- 代码块按语言高亮；
- 支持 Markdown 导入、图片资源、块引用；
- 文档面板独立脏状态和保存流程；
- 格式工具栏可插入跨文档视图：面板复用大纲文档，按住左键拖动多选引用段落；
- 快捷键、搜索和面板布局可通过命令注册表扩展。

## 主题

- 设计 token：`src/ui/design-system/tokens/tokens.css`；
- CSS Cascade Layers：`theme < vendor < tokens < base < components < layout < critical`；
- 浅色主题采用暖中性色，Dockview 会随主题切换；
- 自定义主题通过主题编辑器导入、导出和保存；
- `.tnlook` 外观包由 `appearanceRuntime` 管理，完整保存 dark/light 资源；
- 发布者签名、SHA-256 完整性、对比度预览和回退均可用。

## 安装包

- 自定义 WinForms 安装器，支持选择目录、桌面快捷方式、`.note` 关联；
- 安装 / 卸载过程显示窗口内实时进度；
- 选择目录后自动追加 `TauriNotes`；
- 安装器、应用和卸载器使用 `asInvoker`，不需要管理员权限；
- 应用设置、自定义主题和 WebView2 缓存保存在安装目录的 `data` / `cache`；
- 默认不写 Windows 应用列表的卸载注册表项；
- 卸载器清理程序、设置、缓存、日志和用户勾选过的系统集成，保留 `.note` 文件；
- 构建前需要先生成 release 应用。

产物：

```text
../Tauri Notes Setup.exe
```
