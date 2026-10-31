# 贡献指南

本文件是 Tauri Notes 的开发入口。用户安装和产品介绍见根
[`README.md`](README.md)，设计文档从 [`docs/README.md`](docs/README.md) 进入。

## 文档规范

项目只保留两个 README：

```text
README.md          产品入口
docs/README.md     设计文档索引
```

模块说明放在 `docs/` 下的专题文档中，不再为每个源码目录创建 README：

```text
docs/主题插件.md
docs/Rust-crates.md
```

这样可以避免同一规则散落在多个目录 README 中。新增文档时：

1. 在 `docs/` 下创建 `.md`；
2. 在 `docs/README.md` 增加索引；
3. 如果是开发规则，链接到本文件或对应专题文档；
4. 不提交安装包、构建产物或本地环境文件。

## 开发环境

```powershell
cd tauri_notes
npm install
npm run tauri dev
```

只运行前端：

```powershell
npm run dev
```

## 架构边界

```text
src/kernel/       稳定内核、契约、命令、事件、面板、SDK
src/plugins/      功能插件
src/app/          应用组合根、工具栏、工作区用例
src/application/  服务、端口、Zustand store、状态层
src/infrastructure/ Tauri IPC / 仓储
src/components/   Dockview、导图等共享组件
src/ui/           面板、主题、设计系统、导入预览
src-tauri/        Rust 组合根、命令包装与 crates
```

规则：

- `src-tauri` 只是桌面组合根，业务逻辑在 crates；
- kernel crate 不依赖 plugin crate；
- plugin crate 依赖 `tauri-notes-plugin-api` 和内核契约；
- 插件不依赖其他插件的实现；
- 前端插件只从 `src/kernel/sdk` 和 `src/ui/sdk` 获取公共能力；
- `src/architecture.test.ts` 会检查前端边界；
- Rust workspace 结构见 [`docs/Rust-crates.md`](docs/Rust-crates.md)。

## 状态规则

状态所有权和派生规则见 [`docs/状态架构契约.md`](docs/状态架构契约.md)。

核心约束：

- 业务状态只能有一个可写源；
- 工具栏、选区、统计等是只读投影，不保存第二份可写状态；
- 菜单展开、hover、输入草稿等临时 UI 状态可以保留在组件内；
- 事件只用于通知，不作为状态存储；
- 持久化层是适配器，不是运行时真相。

编辑器状态通过 `EditorSnapshot` 消费，不要在组件里重新复制
`selectedBlock`、`stats` 或工具栏 active 判断。

## 插件规则

每个功能插件：

```text
src/plugins/<id>/
├─ feature.json
├─ manifest.ts
├─ index.ts
├─ ui/
└─ *.test.ts
```

- `feature.json` 声明 manifest、贡献点和 `sdkVersion`；
- 命令、面板、overlay、工具栏、设置等通过贡献点注册；
- 跨插件通信使用命令、事件或端口，不直接 import 实现；
- 插件激活失败必须隔离，不影响其他插件；
- 主题和 `.tnlook` 的实现细节见 [`docs/主题插件.md`](docs/主题插件.md)。

## 设置与插件管理

设置是 shell 能力，不属于主题插件：

```text
src/ui/settings/
├─ SettingsHost.tsx      监听 SETTINGS_OPEN_EVENT
├─ settingsEvents.ts     openSettings / SETTINGS_OPEN_EVENT
└─ SettingsDialog.tsx    读取 settingsSections 贡献
```

- 核心命令 `settings.open` 和工具栏“设置”按钮提供独立入口；
- 快捷键 `Ctrl/Cmd + ,` 可以打开设置；
- 主题菜单的“外观设置…”只是另一个入口，不是唯一入口；
- 功能插件只贡献 `settingsSections`，不能拥有设置入口；
- `manager` 是保留插件，不能被禁用；插件管理器必须始终能重新启用其他插件。

## 验证

```powershell
npm run check        # TypeScript + Vitest
npm run e2e          # Playwright E2E / 视觉回归
npm run build        # 前端生产构建
npm run verify:all   # 全量门禁 + 安装包
```

当前基线：

```text
前端单元测试    136 个通过
Rust 测试        38 个通过
E2E / 视觉回归   35 个通过
```

Rust：

```powershell
cd src-tauri
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

## 文档更新规则

- 当前实现变化时更新 `README.md`、`CHANGELOG.md` 和相关专题文档；
- 架构变化同步更新 `docs/状态架构契约.md` 和 `docs/插件化实施记录.md`；
- 发布新版本时更新版本号、`CHANGELOG.md`、`docs/重构验收报告.md`；
- 不把安装包提交进 Git，发布使用 GitHub Releases。

## 发布

版本位于：

```text
package.json
src-tauri/tauri.conf.json
src-tauri/Cargo.toml
src-tauri/Cargo.lock
```

发布前运行 `npm run verify:all`，然后：

```text
git tag vX.Y.Z
git push origin vX.Y.Z
```

安装包作为 GitHub Release 资产上传，仓库只保留源码和文档。
