# ADR-010：Android 系统分享通过 FileProvider

> 状态：已接受  
> 日期：2026-11-02  
> 关联：Phase 5 系统分享

## 背景

移动端需要把 App 私有目录中的 `.note` 分享给系统应用。App 私有文件不能直接作为
`Intent.EXTRA_STREAM` 的 `file://` URI 暴露给其他应用，Android 7+ 会抛出
`FileUriExposedException`。

## 决策

- 在 Android 工程增加 `SharePlugin`（Tauri mobile plugin）；
- 分享前把源文件复制到 `cacheDir/shared/`；
- 通过 `FileProvider` 生成 `content://` URI；
- 使用 `Intent.ACTION_SEND`，并添加 `FLAG_GRANT_READ_URI_PERMISSION`；
- Rust 侧只暴露 `share_managed_library(path)` 命令；
- 前端通过 `SharePort` 调用，不直接依赖 Kotlin。

## 后果

- 系统 Sharesheet 可显示文件并交给 Quick Share / Gmail / Drive 等应用；
- 分享缓存位于 cacheDir，可被系统回收；
- iOS 需要单独的 UIActivityViewController adapter；
- 分享面板是系统 UI，不进入 WebView E2E。