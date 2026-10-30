import type {
  PluginModule,
  SettingsSectionContribution,
} from "../../kernel/sdk";
import { PluginManagerSection } from "./ui/PluginManagerSection";

export const managerPlugin: PluginModule = {
  activate: (context) => {
    const settings: SettingsSectionContribution = {
      id: "plugin.manager",
      title: "插件",
      description: "启用或禁用功能插件",
      order: 90,
      component: PluginManagerSection,
    };
    context.registerContribution("settingsSections", settings);
  },
};
