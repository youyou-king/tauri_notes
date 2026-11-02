# Android 模拟器验收

> 日期：2026-11-02  
> 环境：Windows 11、Android SDK 37、NDK 27、Android 15 (API 35) x86_64 AVD  
> 构建：`app-x86_64-debug.apk`（本地，用于 x86_64 模拟器）  
> 结果：应用启动并显示移动空状态

## 复现步骤

```powershell
# 1. 创建 AVD
avdmanager create avd -n tn_test `
  -k "system-images;android-35;google_apis;x86_64" `
  --device "pixel_6" --force

# 2. 启动无窗口模拟器
emulator -avd tn_test -no-window -no-audio -no-boot-anim `
  -gpu swiftshader_indirect -no-snapshot

# 3. 安装并启动
adb install -r app-x86_64-debug.apk
adb shell am start -n com.youyou.taurinotes/.MainActivity
```

## 结果

截图：

![Android 空状态](assets/android-emulator-empty.png)

显示内容：

```text
请先打开一个知识库。
打开知识库  新建知识库
```

WebView 已创建，移动 Shell 正常渲染；启动日志中 `webview created` 可见。

## 发现并修复

首次启动为纯白屏。根因：

- 桌面在 `desktop.rs` 中显式创建 `main` 窗口；
- 移动 `mobile.rs` 只注入 `PlatformState`，没有创建窗口；
- `tauri.conf.json` 的 `app.windows` 为空，Android Activity 因此没有任何 WebView。

修复：`mobile.rs` 在 setup 中显式创建单个 `main` WebView 窗口：

```rust
WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
    .title("Tauri Notes")
    .build()?;
```

修复后移动空状态、打开/新建入口均可见。

## 说明

CI 的 `android` workflow 构建 arm64 APK；x86_64 仅用于本地模拟器验证。真机仍建议按
[移动端真机检查清单](移动端真机检查清单.md) 执行。