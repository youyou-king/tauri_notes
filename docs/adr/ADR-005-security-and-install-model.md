# ADR-005：CSP、asset scope 与安装模型

## 状态

已接受并实施。

## 背景

桌面 WebView 需要限制远程内容和本地资源读取；安装器需要可预测的权限边界。

## 决策

- `tauri.conf.json` 显式配置 CSP；
- `assetProtocol` 静态 scope 为空，打开工作区时仅授权对应目录；
- capability 拆分为 core / window / dialog，全部显式绑定 `main`；
- NSIS 安装模型使用 `currentUser`，应用 manifest 使用 `asInvoker`；
- 不启用签名、公证和 updater；用户明确决定跳过发布签名。

## 结果

- 默认不开放整个用户目录；
- 安装不需要管理员权限；
- 发布产物保持未签名，Windows SmartScreen 警告由用户自行决定是否绕过。
