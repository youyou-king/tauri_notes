# CSS 组织

`src/styles.css` 只保留有序导入；样式按稳定区域拆分，避免单文件继续膨胀。

| 文件 | 负责区域 |
|---|---|
| `shell-base.css` | 根变量、应用壳、Dock 基础 |
| `editor-code.css` | Markdown 编辑器、代码块 |
| `board.css` | 看板 |
| `block-editor.css` | 块编辑器基础 |
| `block-toolbar.css` | 块工具栏、链接弹层 |
| `outline-map.css` | 大纲、导图、树 |
| `panels.css` | 面板、主题、控制台 |
| `viewport.css` | 视口引用与选择 |
| `settings-layout.css` | 设置、工作区布局 |
| `mobile-theme.css` | 移动 shell、外观包 |

拆分只保证顺序和层，不改变选择器优先级；视觉回归是验收门槛。
