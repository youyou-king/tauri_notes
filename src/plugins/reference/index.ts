import type {
  CommandContribution,
  PluginModule,
  SettingsSectionContribution,
} from "../../kernel/sdk";
import { ReferenceSettingsSection } from "./ui/ReferenceSettingsSection";

export const referencePlugin: PluginModule = {
  activate: (context) => {
    const command: CommandContribution = {
      id: "reference.resolve",
      capability: "document.read",
      label: "解析引用",
    };
    context.registerContribution("commands", command);
    const settings: SettingsSectionContribution = {
      id: "reference.settings",
      title: "引用",
      description: "引用目标与索引状态",
      component: ReferenceSettingsSection,
    };
    context.registerContribution("settingsSections", settings);
  },
};
