# ADR-009：Android 导出通过 content URI

> 状态：已接受  
> 日期：2026-11-02  
> 关联：Phase 5 移动书库导出

## 背景

Android 的 `ACTION_CREATE_DOCUMENT` 保存面板返回的是：

```text
content://com.android.providers.downloads.documents/document/...
```

该值不是文件系统路径。之前 `export_managed_library` 把它传给 `std::fs::copy`，结果生成了 0 字节占位文件。

## 决策

- 桌面/普通路径继续使用 `std::fs::copy`，并先 checkpoint WAL；
- Android `content://` 目标通过 `tauri-plugin-fs` 的 `FilePath::Url` + content resolver 打开 OutputStream 写入；
- 导出 API 仍是 `export_managed_library(source, destination)`；
- 平台判断只存在于 Rust adapter 层，前端不分支。

```rust
app.fs().open(FilePath::Url(url), options)
```

## 后果

- Android SAF 导出的 `.note` 有真实内容；
- `tauri-plugin-fs` 成为直接依赖，Android Gradle 需要包含它的 plugin project；
- 桌面仍可导出到普通路径；
- 如果未来 iOS 返回 security-scoped URL，也应走同一 adapter 分支。