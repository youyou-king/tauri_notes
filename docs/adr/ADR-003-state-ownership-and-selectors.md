# ADR-003：状态所有权与字段级 selector

## 状态

已接受并实施。

## 背景

编辑器是高频更新源；如果把整个 editor snapshot 塞进同一个组件，任何 transaction 都会让整个预览面板重渲染。

## 决策

- 工作区选择使用原子 `select(mapId, node)`；
- 编辑器状态以快照投影，不在组件内复制 selection / marks；
- 预览面板只订阅 `selectedBlock`；
- 工具栏订阅 `toolbar`，统计订阅 `stats`；
- 字段相等时跳过 state 更新；
- 不使用与 Tiptap 生命周期冲突的外部 store 订阅。

## 结果

- 高频输入不会无条件更新无关区域；
- 选择、工具栏、统计职责清晰；
- `useEditorField` 有单元测试覆盖更新与相等跳过。
