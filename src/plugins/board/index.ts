import type {
  CommandContribution,
  PanelContribution,
  PluginModule,
} from "../../kernel/sdk";
import {
  registerUiRenderer,
  unregisterUiRenderer,
} from "../../kernel/sdk";
import { BoardPanel } from "./BoardPanel";

export const boardPlugin: PluginModule = {
  activate: (context) => {
    const openCommand: CommandContribution = {
      id: "board.open",
      capability: "board.read",
      label: "打开对照板",
      shortcut: "Mod+Shift+B",
      run: () => {
        window.dispatchEvent(new CustomEvent("board:open"));
      },
    };
    context.registerContribution("commands", openCommand);
    const panel: PanelContribution = {
      id: "board",
      title: "对照板",
      icon: "🧩",
      singleton: true,
      renderer: "board.panel",
      defaultPosition: "right",
    };
    context.registerContribution("panels", panel);
    registerUiRenderer(
      "board.panel",
      BoardPanel as unknown as import("react").ComponentType<
        Record<string, unknown>
      >,
    );
  },
  deactivate: () => {
    unregisterUiRenderer("board.panel");
  },
};
