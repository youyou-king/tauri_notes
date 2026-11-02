# Architecture Decision Records

本目录记录已经落地的架构决策，避免同一问题反复讨论。编号只增不改；废弃决策追加新 ADR 说明替代关系。

> 尚未落地的平台抽象方案见 [`平台抽象与移动端重构方案`](../平台抽象与移动端重构方案.md)。

| ADR | 决策 |
|---|---|
| [ADR-001](ADR-001-shell-and-plugin-boundaries.md) | Shell / 插件 / kernel 边界 |
| [ADR-002](ADR-002-plugin-capability-policy.md) | 插件 manifest 与 capability policy |
| [ADR-003](ADR-003-state-ownership-and-selectors.md) | 状态所有权与字段级 selector |
| [ADR-004](ADR-004-persistence-and-migrations.md) | 持久化与迁移 |
| [ADR-005](ADR-005-security-and-install-model.md) | CSP、asset scope 与安装模型 |
| [ADR-006](ADR-006-theme-runtime-layering.md) | 主题运行时分层，不合并为单运行时 |
| [ADR-007](ADR-007-config-format-boundaries.md) | 配置用 TOML、运行时状态用 JSON、内容用 SQLite |
| [ADR-008](ADR-008-android-identifier.md) | Android identifier 使用合法包名，与桌面 identifier 分离 |
| [ADR-009](ADR-009-android-content-uri-export.md) | Android content URI 读写（导入/导出） |
| [ADR-010](ADR-010-android-system-share.md) | Android 系统分享通过 FileProvider + Sharesheet |
