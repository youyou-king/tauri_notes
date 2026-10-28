# Tauri Notes

Tauri 2 + React 19 的导图式 Markdown 知识库。

> **架构状态（2026-10-23）**：Phase A 已完成，编辑区已替换为
> **CodeMirror 6 整篇单一文本缓冲区**；Phase B 初版已接入标题、加粗、斜体、
> 行内代码、引用、代码围栏和列表标记的 Decoration。
> 旧 `VirtualDocument / BlockEditor / TextRunEditor` 已归档到 `src/legacy/`，不参与构建。
>
> 新方案见 [`../设计文档/迁移方案.md`](../设计文档/迁移方案.md)。

完整架构见 [`../设计文档/迁移方案.md`](../设计文档/迁移方案.md)。

## 技术栈

- Tauri 2 + Rust
- React 19 + TypeScript
- Vite 6
- 编辑器目标：CodeMirror 6（整篇 Markdown，Decoration WYSIWYG）
- 停靠：dockview；导图：React Flow；搜索：SQLite FTS5 + jieba

## 运行

前置：

- Node.js 18+（Vite 6）
- Rust stable / nightly（Tauri 2）
- Windows 需要 WebView2 Runtime

```powershell
cd tauri_notes
npm install
npm run tauri dev
```

只跑前端：

```powershell
npm run dev
```

验证：

```powershell
npm run build
cd src-tauri
cargo test
```

> 如果在别的受限环境里 WebView2 仍报 `拒绝访问`，
> 检查项目内 `.webview2/` 是否可写；应用已显式把 WebView2 数据目录放在项目内。

## 示例

项目自带一个演示工作区：

```text
tauri_notes/sample.notes/
```

软件启动时默认自动打开这个示例；也可以点“打开知识库”选择其他目录。

![Phase 2 只读块虚拟列表](screenshot-demo.png)

![React Flow 导图](screenshot-flow-final.png)

![多面板停靠](screenshot-docking.png)

## 当前功能

> 以下描述的是**过渡原型**；编辑区将按 CodeMirror 6 方案替换，dockview/导图/搜索/数据层保留。

- 打开 `.notes` 目录；
- 读取 `meta.json / maps.json / <map>/tree.json`；
- 左栏渲染节点树；
- 点击有文档的节点，按需读取 `<map>/docs/<node>.md`；
- Rust 命令：
  - `open_workspace(path)`；
  - `read_document(workspace, mapId, nodeId)`；
  - `index_document(workspace, mapId, nodeId)`：返回 Block 列表；
- 前端：
  - 默认 **三栏独立 Pane**：大纲（左）/ 文档（中）/ 导图+控制台标签（右）；
  - 每个 Pane 可独立包含多个标签；右侧 Pane 同时有“导图 / 控制台”两个标签；
  - 每个文档面板独立加载自己的 `.md`；
  - 打开新文档默认在右侧分裂新文档面板；相同文档已打开时聚焦已有面板；
  - “新建文档”/“新建导图”分别创建独立文档/导图面板；
  - 导图面板可同时存在多个，互不复用；
  - 拖拽标签可合并到其他 Pane，或拖到边缘生成新的分割 Pane；
  - Windows 下使用 pointer 拖拽策略，并关闭 Tauri 原生拖放拦截；
  - 每个文档面板有独立选区、撤销/重做栈、脏状态；
  - dockview 布局写入 `localStorage`，重启恢复；“重置面板”可清空；
  - `React Flow` 导图：树状自动布局、缩放/平移、点击节点回文档；
  - `Ctrl+P` 搜索面板：标题 + 正文，键盘上下选择、Enter 打开；
  - `VirtualBlockList`（TanStack Virtual）：只挂载可见块；
  - 标题/段落/列表/引用/代码/表格/分割线只读渲染；
  - 代码块编辑使用 CodeMirror 6（行号、历史、行内快捷键、IME、语言高亮）；
  - 只读代码块使用 CodeMirror 只读实例，与编辑态共享同一 theme 和语言高亮；
  - 按围栏语言动态加载：Rust / JS / TS / JSX / TSX / Python / JSON / HTML / CSS / Markdown；
  - 连续普通段落合并为一个 `TextRunEditor` 连续编辑区；
  - Enter 在连续文本区内新建普通段落，Shift+Enter 同一段内软换行；
  - 列表/引用：Shift+Enter 续写 `- ` 或 `> `；Enter 拆出新的普通文本块；
  - 编辑块自动增高，内容变多会推开下面的块，不出现内部滚动条；
  - 上下箭头在块首/块尾时跨块移动；行首 Backspace 合并上一块；
  - 文档末尾始终有“+ 新建块”，点击即可开始输入新段落；
  - Shift+点击跨块选择，`Ctrl+C` 复制为 Markdown，`Ctrl+A` 全选，`Esc` 清空选择；
  - 选中后 `Delete` 删除块，`Ctrl+V` 在选中位置粘贴 Markdown；
  - 点击块进入 `textarea` 源码编辑；
  - 失焦 / Ctrl+Enter 保存，Esc 取消；
  - composition 期间不提交，避免中文 IME 被打断；
- 保存：
  - `save_block` 按块范围替换 Markdown，重新切块，返回新索引；
  - `split_block` 在光标处拆分当前块；
  - 新块为空时只存在于编辑器，输入内容后才写入 Markdown；
  - 写临时文件、备份旧版本、`MoveFileEx` 原子替换；
- 撤销/重做：
  - 前端 BlockDocument 快照栈；
  - `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`；
  - 撤销写回整篇 Markdown；
- 脏状态：
  - 每个面板独立脏状态，dockview 标签标题前缀 `•`；
  - 保存后清除；
  - 关闭窗口、切换节点、切换导图、打开另一知识库前按脏面板数量确认；
- Rust 测试：11 个通过（路径安全 + 工作区读取 + 块切分 + 保存/备份/整篇回写）。

## 目录

```text
tauri_notes/
├── src/                 # React 外壳
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── src-tauri/
│   ├── src/lib.rs       # Tauri 入口 + 命令注册
│   ├── src/workspace.rs # .notes 读取
│   ├── capabilities/
│   ├── icons/
│   └── tauri.conf.json
├── index.html
├── package.json
└── vite.config.ts
```

## 编辑快捷键

- `Ctrl/Cmd + B`：切换加粗（再按取消）；
- `Ctrl/Cmd + I`：切换斜体（再按取消）；
- `Ctrl/Cmd + K`：插入链接；
- `Ctrl/Cmd + Alt + 1..6`：切换标题级别（再按取消）；
- `Ctrl/Cmd + Alt + 0`：清除标题；
- `Ctrl/Cmd + S`：立即保存；
- 代码围栏按语言高亮：Rust / JS / TS / Python / JSON / HTML / CSS，语言包按需加载。

## 当前边界

- 撤销是整篇文档快照，不是字符级操作；
- 编辑期间没有自动保存计时器，失焦/Ctrl+Enter 保存；
- 还没有跨块拖拽；
- 代码块高亮只覆盖常见语言，未支持的语言保持纯文本；
- 关闭单个文档面板时还没有未保存确认（关窗口有聚合确认）；
- 列表/引用编辑时仍显示 Markdown 标记；
- 表格、任务列表的 Enter 语义还未细分；
- 默认控制台在右栏标签中；拖到下方可生成底部控制台 Pane；
- 搜索目前是 Rust 逐文件扫描，不是 FTS5/jieba 索引；
- 导图还没有手动拖动节点/持久化位置；

## 下一步

Phase A/B 已完成基础连续编辑与装饰层。继续：

1. Phase C：更多输入边界测试；
2. Phase D：notify 文件监听替换轮询、批量 I/O、FTS5 + jieba；
3. Phase E：主题 Compartment、性能验收、清理旧 Block 组件。

## 与 Bevy 版本的关系

- `bevy_block_editor` 保留为参考实现，不再开发；
- 可复用的 Rust 领域逻辑会逐步迁移到 `src-tauri`；
- 不复用 Bevy UI/停靠/渲染。
