import {
  APP_EVENTS,
  emitAppEvent,
  type AppearancePackContribution,
  type CommandContribution,
  type PluginModule,
  type SettingsSectionContribution,
  type ToolbarItemContribution,
} from "../../kernel/sdk";
import { ThemeToolbarItem } from "./ThemeToolbarItem";
import { ThemeSettingsSection } from "./ui/ThemeSettingsSection";

export { readAppearanceAsset, readAppearancePack } from "./appearanceZip";
export { validateAppearancePack } from "./appearancePack";
export type { AppearancePackManifest } from "./appearancePack";

export const themePlugin: PluginModule = {
  activate: (context) => {
    const openCommand: CommandContribution = {
      id: "theme.open",
      capability: "appearance.read",
      label: "打开外观设置",
      shortcut: "Mod+Shift+T",
      run: () => {
        emitAppEvent(APP_EVENTS.themeOpen);
      },
    };
    context.registerContribution("commands", openCommand);
    const applyCommand: CommandContribution = {
      id: "theme.apply",
      capability: "appearance.write",
      label: "应用外观",
    };
    context.registerContribution("commands", applyCommand);
    const toolbar: ToolbarItemContribution = {
      id: "theme.menu",
      label: "主题",
      order: 20,
      component: ThemeToolbarItem,
    };
    context.registerContribution("toolbarItems", toolbar);
    const settings: SettingsSectionContribution = {
      id: "theme.settings",
      title: "外观",
      description: "主题、皮肤与外观包",
      component: ThemeSettingsSection,
    };
    context.registerContribution("settingsSections", settings);
    const builtIn: AppearancePackContribution = {
      id: "theme.builtin",
      name: "经典外观",
      builtIn: true,
    };
    context.registerContribution("appearancePacks", builtIn);
  },
};
