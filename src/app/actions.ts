import { DEFAULT_BINDINGS } from "../kernel/action/bindings";
import { registerAction } from "../kernel/action/registry";
import { getCommand } from "../kernel/command";
import type { ActionDefinition } from "../kernel/action/types";
import { registerDocumentActions } from "./documentActions";

function commandAction(
  id: string,
  title: string,
  category: string,
  options: Partial<Pick<ActionDefinition, "allowInEditable">> = {},
): void {
  registerAction({
    id,
    title,
    category,
    scope: "global",
    platforms: ["desktop", "mac", "mobile"],
    defaultBindings: DEFAULT_BINDINGS[id] ?? [],
    allowInEditable: options.allowInEditable ?? true,
    enabled: () => Boolean(getCommand(id)),
    run: ({ runCommand }) => runCommand(id),
  });
}

// Shell and feature actions. Command implementations stay in the command
// registry; this table owns titles and bindings.
commandAction("settings.open", "设置", "shell");
commandAction("search.open", "搜索", "navigation");
commandAction("help.open", "使用帮助", "navigation");
commandAction("board.open", "对照板", "navigation");
commandAction("theme.open", "外观设置", "appearance");
commandAction("viewport.pick", "选择视图内容", "editor");

commandAction("knowledge.create", "新建知识库", "knowledge");
commandAction("knowledge.open", "打开知识库", "knowledge");
commandAction("knowledge.backup", "备份知识库", "knowledge");
commandAction("association.set", "设置 .note 文件关联", "knowledge");
commandAction("association.clear", "清除 .note 文件关联", "knowledge");
commandAction("view.outline", "大纲", "navigation");
commandAction("view.console", "控制台", "navigation");
commandAction("view.reset-layout", "重置布局", "navigation");

registerDocumentActions();
