# scripts

这个目录存放按类别组织的 Rust 脚本 crate。

约定：**一类脚本一个 crate**，命令作为该 crate 的子命令；不再按单个命令拆 crate。

```text
scripts/
├── Cargo.toml      # workspace
├── mobile/         # 移动端（Android 模拟器）
├── installer/      # Windows 安装器构建与校验
├── release/        # 版本同步
└── verify/         # 全量验证
```

| crate | 类别 | 命令 |
|---|---|---|
| `mobile` | 移动端 | `doctor`、`devices`、`start`、`up`、`launch`、`install`、`screenshot`、`reset`、`stop`、`smoke` |
| `installer` | 安装器 | `build`、`verify`、`verify-install` |
| `release` | 发布 | `version check`、`version set` |
| `verify` | 验证 | 无子命令，按顺序执行全部检查 |

所有命令都从仓库根目录运行，统一使用：

```bash
cargo run --quiet --manifest-path scripts/Cargo.toml -p <crate> -- <命令> [参数]
```

## mobile：Android 模拟器

| 子命令 | 说明 |
|---|---|
| `doctor` | 检查 SDK、设备、AVD、APK |
| `devices` | 列出已连接设备 |
| `start` | 启动模拟器 |
| `up` | 启动模拟器；应用未安装时自动安装，再打开应用 |
| `launch` | 打开已安装应用；未安装时给出明确提示 |
| `install` | 按设备 ABI 安装对应 APK |
| `screenshot` | 截图 |
| `reset` | 清空应用数据 |
| `stop` | 关闭模拟器 |
| `smoke` | 前台检查 + 截图 |

```bash
cargo run --quiet --manifest-path scripts/Cargo.toml -p mobile -- doctor
cargo run --quiet --manifest-path scripts/Cargo.toml -p mobile -- up --headless
cargo run --quiet --manifest-path scripts/Cargo.toml -p mobile -- screenshot --out test-artifacts/mobile/home.png
```

SDK 查找顺序：

1. `--sdk <path>`
2. `ANDROID_HOME`
3. `ANDROID_SDK_ROOT`
4. `PATH` 中的 `adb`
5. 常见 SDK 目录（Windows 会扫描各盘符的 `Android\sdk`）

常用参数：`--avd <name>`、`--device <serial>`、`--headless`、`--force`、`--launch`、`--timeout <sec>`、`--wait <sec>`、`--apk <path>`、`--out <path>`、`--gpu <mode>`。

模拟器默认使用运行者自己的 AVD 目录（如 `%USERPROFILE%\.android\avd`）；可用 `--avd` 指定名称，或用 `ANDROID_AVD_HOME` 指定目录。`start` / `up` 启动失败时可查看 `.tmp/mobile/emulator.log`，超时错误也会打印该路径。

## installer：Windows 安装器

需要 Windows、.NET Framework 的 `csc.exe`，以及先完成 release 构建。

```bash
cargo run --quiet --manifest-path scripts/Cargo.toml -p installer -- build
cargo run --quiet --manifest-path scripts/Cargo.toml -p installer -- build --output "Tauri Notes Setup.exe"
cargo run --quiet --manifest-path scripts/Cargo.toml -p installer -- verify --setup "Tauri Notes Setup.exe"
cargo run --quiet --manifest-path scripts/Cargo.toml -p installer -- verify-install --setup "Tauri Notes Setup.exe"
```

- `build` 编译卸载器和安装器，默认输出到 `tauri_notes` 上一级的 `Tauri Notes Setup.exe`；
- `verify` 校验安装器内嵌资源与 release 应用、图标、帮助知识库一致；
- `verify-install` 静默安装到 `.tmp` 下的临时目录，校验释放的文件后清理。
- `verify-install` 的 `--target` 只允许放在项目的 `.tmp` 目录内，避免误删用户文件。
- `verify` 读取 .NET 托管资源时会调用系统 PowerShell 反射；构建和哈希比较仍在 crate 内。

## release：版本同步

```bash
cargo run --quiet --manifest-path scripts/Cargo.toml -p release -- version check
cargo run --quiet --manifest-path scripts/Cargo.toml -p release -- version set 0.1.2
```

- `version` 以 `package.json` 为准，同步 `tauri.conf.json`、`Cargo.toml`、`Cargo.lock`。

## verify：全量验证

```bash
cargo run --quiet --manifest-path scripts/Cargo.toml -p verify --
cargo run --quiet --manifest-path scripts/Cargo.toml -p verify -- --skip-build --skip-installer
```

选项：

| 选项 | 说明 |
|---|---|
| `--skip-build` | 跳过 Tauri release 构建 |
| `--skip-installer` | 跳过安装器构建与校验 |
| `--cargo <path>` | 指定 cargo 可执行文件 |

验证顺序：前端 check / e2e / build → Rust clippy / test → 脚本 clippy / test → Tauri 构建 → 安装器构建与校验。非 Windows 平台会自动跳过安装器步骤。

## npm 别名

```bash
npm run mobile:doctor
npm run mobile:up
npm run version:check
npm run version:set -- 0.1.2
npm run verify:all
```

## 测试

```bash
cargo test --manifest-path scripts/Cargo.toml --workspace
cargo clippy --manifest-path scripts/Cargo.toml --workspace --all-targets -- -D warnings
```

## 扩展

- 新增同类命令：在对应 crate 里登记子命令，不新建 crate；
- 新增一类脚本：在 `scripts/` 下新建 crate 并加入 `scripts/Cargo.toml` 的 `members`；
- 代码注释统一使用中文，简洁说明意图，避免逐行复述。

## 说明

- CI 的 Android APK 是 arm64；x86_64 模拟器需要 x86_64 APK。
- 移动端脚本只负责启动、安装、截图和 smoke，不编译 APK。
- 仓库不携带 Android SDK 或 AVD；请自行安装 SDK，并准备自己的 AVD。
