# ADR-004：持久化与迁移

## 状态

已接受并实施。

## 背景

数据分散在 SQLite、localStorage、IndexedDB 和 `.note` 文件中；迁移必须可恢复，不能半升级。

## 决策

- SQLite 使用 `schema_migrations`，每个版本在事务中执行，迁移前自动备份并校验；
- 当前 schema v7，文档删除使用 `deleted_at` 软删除；
- 浏览器记录共用 `runMigrations`；
- session 为 v2，theme 为 v2，appearance IndexedDB 为 v2；
- dock layout 独立版本化存储并在启动时恢复；
- 未来版本记录被拒绝，回退到默认值。

## 结果

- 迁移失败回滚并保留备份；
- 各存储有明确当前版本；
- 删除文档可以恢复；
- 布局和会话可以跨重启恢复。
