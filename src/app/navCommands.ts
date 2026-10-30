import { registerCommand } from "../kernel/command";

export type NavCommandContext = {
  busy: boolean;
  hasWorkspace: boolean;
  createKnowledge: () => void;
  openKnowledge: () => void;
  backup: () => void;
  setAssociation: () => void;
  clearAssociation: () => void;
  toggleOutline: () => void;
  toggleConsole: () => void;
  resetLayout: () => void;
};

registerCommand<NavCommandContext>({
  id: "knowledge.create",
  label: "新建知识库…",
  enabled: (context) => !context.busy,
  run: (context) => context.createKnowledge(),
});

registerCommand<NavCommandContext>({
  id: "knowledge.open",
  label: "打开知识库…",
  enabled: (context) => !context.busy,
  run: (context) => context.openKnowledge(),
});

registerCommand<NavCommandContext>({
  id: "knowledge.backup",
  label: "保存",
  enabled: (context) => !context.busy && context.hasWorkspace,
  run: (context) => context.backup(),
});

registerCommand<NavCommandContext>({
  id: "association.set",
  label: "设置 .note 文件关联",
  run: (context) => context.setAssociation(),
});

registerCommand<NavCommandContext>({
  id: "association.clear",
  label: "清除 .note 文件关联",
  run: (context) => context.clearAssociation(),
});

registerCommand<NavCommandContext>({
  id: "view.outline",
  label: "大纲",
  run: (context) => context.toggleOutline(),
});

registerCommand<NavCommandContext>({
  id: "view.console",
  label: "控制台",
  run: (context) => context.toggleConsole(),
});

registerCommand<NavCommandContext>({
  id: "view.reset-layout",
  label: "重置布局",
  run: (context) => context.resetLayout(),
});
