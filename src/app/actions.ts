import { DEFAULT_BINDINGS } from "../kernel/action/bindings";
import { registerAction } from "../kernel/action/registry";
import { getCommand } from "../kernel/command";
import type { ActionDefinition } from "../kernel/action/types";
import { registerDocumentActions } from "./documentActions";
import { registerLibraryActions } from "./libraryActions";
import { COMMAND_LABELS } from "./commandLabels";

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
commandAction("settings.open", COMMAND_LABELS["settings.open"], "shell");
commandAction("search.open", "搜索", "navigation");
commandAction("help.open", COMMAND_LABELS["help.open"], "navigation");
commandAction("board.open", "对照板", "navigation");
commandAction("theme.open", "外观", "appearance");
commandAction("viewport.pick", "选择视图内容", "editor");

commandAction(
  "knowledge.create",
  COMMAND_LABELS["knowledge.create"],
  "knowledge",
);
commandAction(
  "knowledge.open",
  COMMAND_LABELS["knowledge.open"],
  "knowledge",
);
commandAction(
  "knowledge.backup",
  COMMAND_LABELS["knowledge.backup"],
  "knowledge",
);
commandAction("view.outline", COMMAND_LABELS["view.outline"], "navigation");
commandAction("view.console", COMMAND_LABELS["view.console"], "navigation");
commandAction(
  "view.clear-layout",
  COMMAND_LABELS["view.clear-layout"],
  "navigation",
);

registerDocumentActions();

registerLibraryActions();
