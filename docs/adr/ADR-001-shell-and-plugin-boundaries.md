# ADR-001：Shell / 插件 / kernel 边界

## 状态

已接受并实施。

## 背景

插件需要扩展 UI、命令和面板，但不能让 feature 插件互相 import，也不能让 shell 依赖具体插件实现。

## 决策

- `src/kernel/sdk` 提供插件可用的稳定契约；
- `src/ui/sdk` 提供 shell UI 能力；
- feature 插件只通过 SDK 获取 shell 能力、事件和端口；
- shell 通过注册表解析插件贡献，不直接 import feature 插件；
- 跨模块应用事件统一走 `APP_EVENTS`，面板拖拽走 typed `PanelEvent`。

## 结果

- 插件可以独立禁用而不破坏 shell；
- 新增插件不需要修改 `App.tsx`；
- 架构测试扫描插件边界和事件 registry，防止回退。
