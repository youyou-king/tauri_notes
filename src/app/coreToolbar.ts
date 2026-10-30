import type { ToolbarItemContribution } from "../kernel/plugin";

/**
 * Shell-owned toolbar composition. These are data, not JSX branches in the
 * toolbar, so the shell and plugin contributions share one render path.
 */
export const CORE_TOOLBAR_ITEMS: ToolbarItemContribution[] = [
  {
    id: "knowledge.create",
    label: "新建知识库…",
    menu: "knowledge",
    menuTitle: "知识库",
    menuOrder: 10,
    order: 10,
    commandId: "knowledge.create",
    requiresIdle: true,
  },
  {
    id: "knowledge.open",
    label: "打开知识库…",
    menu: "knowledge",
    menuTitle: "知识库",
    menuOrder: 10,
    order: 20,
    commandId: "knowledge.open",
    requiresIdle: true,
  },
  {
    id: "knowledge.backup",
    label: "保存",
    menu: "knowledge",
    menuTitle: "知识库",
    menuOrder: 10,
    order: 30,
    commandId: "knowledge.backup",
    requiresIdle: true,
    requiresWorkspace: true,
  },
  {
    id: "association.set",
    label: "设置 .note 文件关联",
    menu: "knowledge",
    menuTitle: "知识库",
    menuOrder: 10,
    order: 40,
    commandId: "association.set",
  },
  {
    id: "association.clear",
    label: "清除 .note 文件关联",
    menu: "knowledge",
    menuTitle: "知识库",
    menuOrder: 10,
    order: 50,
    commandId: "association.clear",
  },
  {
    id: "view.outline",
    label: "大纲",
    menu: "view",
    menuTitle: "视图",
    menuOrder: 20,
    order: 10,
    commandId: "view.outline",
  },
  {
    id: "view.console",
    label: "控制台",
    menu: "view",
    menuTitle: "视图",
    menuOrder: 20,
    order: 20,
    commandId: "view.console",
  },
  {
    id: "view.reset-layout",
    label: "重置布局",
    menu: "view",
    menuTitle: "视图",
    menuOrder: 20,
    order: 30,
    commandId: "view.reset-layout",
  },
];
