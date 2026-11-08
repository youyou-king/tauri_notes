/**
 * Core command names are product copy. Commands, actions and toolbar items
 * must resolve their label from this table rather than re-declaring strings.
 */
export const COMMAND_LABELS = {
  "knowledge.create": "新建知识库",
  "knowledge.open": "打开知识库",
  "knowledge.backup": "备份知识库",
  "view.outline": "大纲",
  "view.console": "控制台",
  "view.clear-layout": "清空布局",
  "settings.open": "设置",
  "help.open": "帮助",
} as const;

export type CoreCommandId = keyof typeof COMMAND_LABELS;

/** Top-level navigation names shared by desktop toolbar and mobile drawer. */
export const NAV_LABELS = {
  knowledge: "知识库",
  view: "视图",
  appearance: "外观",
  settings: "设置",
  help: "帮助",
} as const;