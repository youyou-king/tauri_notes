export type CommandContribution = {
  id: string;
  label: string;
  shortcut?: string;
  description?: string;
  capability?: string;
  run?: (context: unknown) => void | Promise<void>;
};

export type PanelContribution = {
  id: string;
  title: string;
  icon?: string;
  singleton?: boolean;
  renderer: string;
  defaultPosition?: "left" | "right" | "center" | "bottom";
};

export type OverlayContribution = {
  id: string;
  renderer: string;
};

export type ToolbarItemContribution = {
  id: string;
  label: string;
  icon?: string;
  menu?: string;
  menuTitle?: string;
  menuOrder?: number;
  order?: number;
  commandId?: string;
  requiresIdle?: boolean;
  requiresWorkspace?: boolean;
  component?: import("react").ComponentType;
};

export type ContextMenuItemContribution = {
  id: string;
  label: string;
  target: "tree" | "map" | "editor" | "board" | "document";
  order?: number;
};

export type SettingsSectionContribution = {
  id: string;
  title: string;
  description?: string;
  order?: number;
  component?: import("react").ComponentType;
};

export type AppearancePackContribution = {
  id: string;
  name: string;
  mode?: "dark" | "light" | "dual";
  builtIn?: boolean;
};

export type BlockTypeContribution = {
  id: string;
  nodeName: string;
  schemaVersion: number;
};

export type MapNodeTypeContribution = {
  id: string;
  nodeType: string;
  schemaVersion: number;
};

export type MigrationContribution = {
  id: string;
  version: number;
  description?: string;
};
