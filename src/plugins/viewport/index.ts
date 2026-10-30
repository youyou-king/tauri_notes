import type { ComponentType } from "react";
import type {
  CommandContribution,
  PluginModule,
} from "../../kernel/sdk";
import {
  registerUiRenderer,
  unregisterUiRenderer,
} from "../../kernel/sdk";
import { ViewportSelectionPanel } from "./ui/ViewportSelectionPanel";

export const viewportPlugin: PluginModule = {
  activate: (context) => {
    const command: CommandContribution = {
      id: "viewport.pick",
      capability: "document.write",
      label: "选择视图内容",
      shortcut: "Mod+Alt+V",
    };
    context.registerContribution("commands", command);
    registerUiRenderer(
      "viewport.selection",
      ViewportSelectionPanel as unknown as ComponentType<
        Record<string, unknown>
      >,
    );
  },
  deactivate: () => {
    unregisterUiRenderer("viewport.selection");
  },
};
