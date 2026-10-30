import type {
  CommandContribution,
  OverlayContribution,
  PluginModule,
} from "../../kernel/sdk";
import {
  registerUiRenderer,
  unregisterUiRenderer,
} from "../../kernel/sdk";
import { SearchOverlay } from "./SearchOverlay";

export const searchPlugin: PluginModule = {
  activate: (context) => {
    const command: CommandContribution = {
      id: "search.open",
      capability: "document.read",
      label: "搜索",
      shortcut: "Mod+P",
      run: () => {
        window.dispatchEvent(new CustomEvent("search:open"));
      },
    };
    context.registerContribution("commands", command);
    registerUiRenderer("search.overlay", SearchOverlay);
    const overlay: OverlayContribution = {
      id: "search.overlay",
      renderer: "search.overlay",
    };
    context.registerContribution("overlays", overlay);
  },
  deactivate: () => {
    unregisterUiRenderer("search.overlay");
  },
};
