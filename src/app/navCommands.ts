import { registerCommand } from "../kernel/command";
import { COMMAND_LABELS } from "./commandLabels";

export type NavCommandContext = {
  busy: boolean;
  hasWorkspace: boolean;
  createKnowledge: () => void;
  openKnowledge: () => void;
  backup: () => void;
  toggleOutline: () => void;
  toggleConsole: () => void;
  clearLayout: () => void;
  openSettings: () => void;
};

registerCommand<NavCommandContext>({
  id: "knowledge.create",
  label: COMMAND_LABELS["knowledge.create"],
  enabled: (context) => !context.busy,
  run: (context) => context.createKnowledge(),
});

registerCommand<NavCommandContext>({
  id: "knowledge.open",
  label: COMMAND_LABELS["knowledge.open"],
  enabled: (context) => !context.busy,
  run: (context) => context.openKnowledge(),
});

registerCommand<NavCommandContext>({
  id: "knowledge.backup",
  label: COMMAND_LABELS["knowledge.backup"],
  enabled: (context) => !context.busy && context.hasWorkspace,
  run: (context) => context.backup(),
});

registerCommand<NavCommandContext>({
  id: "view.outline",
  label: COMMAND_LABELS["view.outline"],
  run: (context) => context.toggleOutline(),
});

registerCommand<NavCommandContext>({
  id: "view.console",
  label: COMMAND_LABELS["view.console"],
  run: (context) => context.toggleConsole(),
});

registerCommand<NavCommandContext>({
  id: "view.clear-layout",
  label: COMMAND_LABELS["view.clear-layout"],
  run: (context) => context.clearLayout(),
});

registerCommand<NavCommandContext>({
  id: "settings.open",
  label: COMMAND_LABELS["settings.open"],
  run: (context) => context.openSettings(),
});