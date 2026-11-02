# scripts

这个目录同时存放构建脚本和移动端测试工具。

移动端测试工具已经从单个 Node 脚本拆成 **Rust workspace**，每个命令是一个独立 crate，可以直接 `cargo run -p <name>`：

```text
scripts/
├── Cargo.toml              # workspace
├── mobile-test-core/       # SDK / adb / emulator 公共库
├── mobile-doctor/          # 检查 SDK、设备、AVD、APK
├── mobile-devices/         # 列出设备
├── mobile-start/           # 启动模拟器
├── mobile-up/              # 启动模拟器 + 打开应用
├── mobile-launch/          # 打开已安装应用
├── mobile-install/         # 安装 APK
├── mobile-screenshot/      # 截图
├── mobile-reset/           # 清空应用数据
├── mobile-stop/            # 关闭模拟器
└── mobile-smoke/           # 前台检查 + 截图
```

## 运行

在仓库根目录：

```bash
cargo run --quiet --manifest-path scripts/Cargo.toml -p mobile-doctor
cargo run --quiet --manifest-path scripts/Cargo.toml -p mobile-up
cargo run --quiet --manifest-path scripts/Cargo.toml -p mobile-smoke
```

也可以进入 `scripts/`：

```bash
cd scripts
cargo run --quiet -p mobile-doctor
cargo run --quiet -p mobile-up
```

通过 npm（内部同样调用 cargo）：

```bash
npm run mobile:doctor
npm run mobile:up
npm run mobile:screenshot
```

## SDK 查找顺序

1. `--sdk <path>`
2. 项目内 `tools/android-sdk/`（已 gitignore）
3. `ANDROID_HOME`
4. `ANDROID_SDK_ROOT`
5. `PATH` 中的 `adb`
6. 常见 SDK 目录，Windows 会扫描各盘符的 `Android\sdk`

项目内 SDK 目录：

```text
tauri_notes/tools/android-sdk/
```

## 参数

| 参数 | 说明 |
|---|---|
| `--sdk <path>` | 指定 Android SDK |
| `--avd <name>` | AVD 名称，默认 `tn_test` |
| `--device <serial>` | 多设备时指定 |
| `--headless` | 无窗口启动 |
| `--force` | 关闭已有模拟器后重启 |
| `--launch` | 启动后打开应用 |
| `--timeout <sec>` | 启动超时，默认 180 |
| `--wait <sec>` | smoke 等待前台时间，默认 2.5 |
| `--apk <path>` | install 指定 APK |
| `--out <path>` | screenshot 输出路径 |
| `--gpu <mode>` | emulator GPU 模式 |

示例：

```bash
cargo run --quiet --manifest-path scripts/Cargo.toml -p mobile-up -- --headless
cargo run --quiet --manifest-path scripts/Cargo.toml -p mobile-install -- --apk "C:/path/app.apk"
cargo run --quiet --manifest-path scripts/Cargo.toml -p mobile-screenshot -- --out test-artifacts/mobile/home.png
```

截图默认写入：

```text
test-artifacts/mobile/
```

## Windows 中文路径

Android Emulator 对包含中文的 AVD/SDK 路径存在兼容问题；如果 `mobile-up` 卡在启动阶段，可以先用系统 SDK 验证模拟器：

```bash
cargo run --quiet --manifest-path scripts/Cargo.toml -p mobile-up -- --sdk D:/Android/sdk
```

项目内 SDK 仍会被 `mobile-doctor` 优先发现，这个问题属于模拟器自身的路径处理，不是 SDK 发现逻辑。

## 测试

```bash
cargo test --manifest-path scripts/Cargo.toml --workspace
```

`mobile-test-core` 包含参数解析和平台二进制名测试。

## 说明

- CI 的 Android APK 是 arm64；x86_64 模拟器需要 x86_64 APK。
- 脚本只负责启动、安装、截图和 smoke，不编译 APK。
- 项目内 SDK 目录不提交。