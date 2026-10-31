import {
  APP_EVENTS,
  emitAppEvent,
  type CommandContribution,
  type PluginModule,
  type ToolbarItemContribution,
} from "../../kernel/sdk";

export const helpPlugin: PluginModule = {
  activate: (context) => {
    const command: CommandContribution = {
      id: "help.open",
      label: "使用帮助",
      run: () => {
        emitAppEvent(APP_EVENTS.helpOpen);
      },
    };
    context.registerContribution("commands", command);
    const toolbarItem: ToolbarItemContribution = {
      id: "help.button",
      label: "帮助",
      commandId: "help.open",
      order: 100,
    };
    context.registerContribution("toolbarItems", toolbarItem);
  },
};
