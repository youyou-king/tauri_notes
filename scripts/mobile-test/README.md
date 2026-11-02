# 移动端测试脚本

跨平台（Windows / macOS / Linux）的 Android 模拟器辅助脚本。只依赖 Node.js 和 Android SDK，不依赖 PowerShell。

## 前置条件

- Node.js 18+
- Android SDK，包含：
  - `platform-tools/adb`
  - `emulator/emulator`
- 至少一个 AVD，例如 `tn_test`
- 应用已安装到模拟器

SDK 发现顺序：

1. `--sdk <path>`
2. `ANDROID_HOME`
3. `ANDROID_SDK_ROOT`
4. 常见默认安装目录（Windows `%LOCALAPPDATA%\Android\Sdk`、macOS `~/Library/Android/sdk`、Linux `~/Android/Sdk` / `/opt/android-sdk`）

## 命令

在仓库根目录执行：

```bash
# 检查 SDK、adb、emulator、AVD、APK
node scripts/mobile-test/cli.mjs doctor

# 启动模拟器（有窗口）
node scripts/mobile-test/cli.mjs start

# 启动模拟器并打开应用
node scripts/mobile-test/cli.mjs up

# 只打开已安装的应用
node scripts/mobile-test/cli.mjs launch

# 查看设备
node scripts/mobile-test/cli.mjs devices

# 安装 APK（默认找最新的 build 输出）
node scripts/mobile-test/cli.mjs install
node scripts/mobile-test/cli.mjs install --apk C:/path/to/app.apk

# 启动应用、检查前台 Activity 并截图
node scripts/mobile-test/cli.mjs smoke

# 截图，默认写入 test-artifacts/mobile/
node scripts/mobile-test/cli.mjs screenshot

# 清空应用数据
node scripts/mobile-test/cli.mjs reset

# 关闭模拟器
node scripts/mobile-test/cli.mjs stop
```

也可以通过 npm：

```bash
npm run mobile:doctor
npm run mobile:up
npm run mobile:launch
npm run mobile:smoke
npm run mobile:install
npm run mobile:screenshot
npm run mobile:reset
npm run mobile:stop
```

## 常用参数

| 参数 | 说明 |
|---|---|
| `--avd <name>` | AVD 名称，默认 `tn_test` |
| `--headless` | 无窗口启动 |
| `--no-snapshot` | 冷启动（默认已启用） |
| `--force` | 已有设备时重启模拟器 |
| `--device <serial>` | 多设备时指定 |
| `--sdk <path>` | 显式指定 Android SDK |
| `--apk <path>` | 指定 APK |
| `--out <path>` | 指定截图路径 |
| `--launch` | `start` 完成后顺手打开应用 |

示例：

```bash
# 无窗口启动，然后打开应用
node scripts/mobile-test/cli.mjs start --headless --launch

# 指定 SDK 和 AVD
node scripts/mobile-test/cli.mjs up --sdk D:/Android/sdk --avd tn_test

# 指定 APK 安装
node scripts/mobile-test/cli.mjs install --apk "C:/tn/src-tauri/gen/android/app/build/outputs/apk/x86_64/debug/app-x86_64-debug.apk"

# 截图到指定文件
node scripts/mobile-test/cli.mjs screenshot --out test-artifacts/mobile/home.png
```

## APK 说明

- CI 构建的 Android APK 是 **arm64**，用于真机 / arm64 模拟器。
- x86_64 模拟器需要 x86_64 APK。
- 脚本只负责启动、安装和截图，不负责编译 APK。
- 默认在 `src-tauri/gen/android/app/build/outputs/apk/` 下寻找最新 APK。

## 输出

截图默认输出到：

```text
test-artifacts/mobile/mobile-<timestamp>.png
```

该目录已加入 `.gitignore`。