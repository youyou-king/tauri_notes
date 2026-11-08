import type {
  CommandContribution,
  PluginModule,
} from "../../kernel/sdk";

export const referencePlugin: PluginModule = {
  activate: (context) => {
    const command: CommandContribution = {
      id: "reference.resolve",
      capability: "document.read",
      label: "解析引用",
    };
    context.registerContribution("commands", command);
  },
};
