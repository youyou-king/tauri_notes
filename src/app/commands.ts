import { registerCommand } from "../ui/commands/registry";

export type AppCommandContext = {
  hasWorkspace: boolean;
  openBoard: () => void;
  openSearch: () => void;
};

registerCommand<AppCommandContext>({
  id: "board.open",
  label: "打开对照板",
  shortcut: "Mod+Shift+B",
  enabled: (context) => context.hasWorkspace,
  run: (context) => context.openBoard(),
});

registerCommand<AppCommandContext>({
  id: "search.open",
  label: "搜索",
  shortcut: "Mod+P",
  enabled: (context) => context.hasWorkspace,
  run: (context) => context.openSearch(),
});
