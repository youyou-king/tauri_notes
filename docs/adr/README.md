# Architecture Decision Records

本目录记录已经落地的架构决策，避免同一问题反复讨论。编号只增不改；废弃决策追加新 ADR 说明替代关系。

> 尚未落地的平台抽象方案见 [`平台抽象与移动端重构方案`](../平台抽象与移动端重构方案.md)；实施后追加 ADR-008。

| ADR | 决策 |
|---|---|
| [ADR-001](ADR-001-shell-and-plugin-boundaries.md) | Shell / 插件 / kernel 边界 |
| [ADR-002](ADR-002-plugin-capability-policy.md) | 插件 manifest 与 capability policy |
| [ADR-003](ADR-003-state-ownership-and-selectors.md) | 状态所有权与字段级 selector |
| [ADR-004](ADR-004-persistence-and-migrations.md) | 持久化与迁移 |
| [ADR-005](ADR-005-security-and-install-model.md) | CSP、asset scope 与安装模型 |
| [ADR-006](ADR-006-theme-runtime-layering.md) | 主题运行时分层，不合并为单运行时 |
| [ADR-007](ADR-007-config-format-boundaries.md) | 配置用 TOML、运行时状态用 JSON、内容用 SQLite |
