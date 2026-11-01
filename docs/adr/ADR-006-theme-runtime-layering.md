# ADR-006：主题运行时分层，不合并为单运行时

## 状态

已接受并实施。

## 背景

主题由两个生命周期组成：

- 基础主题：mode / custom theme / system preference；
- appearance pack：包资源加载、按模式激活、失败回滚、IndexedDB 资产。

两者都写 CSS 变量，如果放在同一个 effect 里，加载/回滚顺序会让状态难以推理。

## 决策

保留分层，不把所有逻辑合并为单一 `ThemeRuntime`：

- `ThemeProvider` 负责选择、解析和基础 token；
- 基础 token 写入抽到 `useBaseThemeTokens`；
- appearance pack 激活时拥有 overlay token，ThemeProvider 不覆盖；
- `appearance:applied` 作为两层之间的显式协调事件；
- appearance runtime 继续由主题插件管理，保持可回滚和独立加载。

## 结果

- base 层和 overlay 层职责清晰；
- appearance pack 失败不影响基础主题；
- 主题切换和 pack 回滚有明确顺序；
- 代价是需要一个协调事件，而不是单一 store。

## 替代方案

曾考虑把所有状态合并到 `ThemeRuntime`，但会让插件资产加载、回滚和基础主题选择耦合，因此不采用。
