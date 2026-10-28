# Legacy Block Editor（归档）

这些文件是 CodeMirror 6 迁移前的虚拟化 Block 编辑器实现，已不参与构建。

迁移完成后，编辑区由 `src/components/MarkdownEditor.tsx`、`src/editor/*` 负责；
Rust 侧原有的 Block 命令暂时保留兼容，后续可删除。

保留原因：Markdown 切块、变量高度虚拟列表、逐块编辑等设计仍有参考价值。
