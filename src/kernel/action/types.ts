export type ActionId = string;

export type InputPlatform = "desktop" | "mac" | "mobile";

export type ActionScope = "global" | "editor" | "panel" | "dialog" | "mobile";

export type InputSource = "keyboard" | "pointer" | "surface" | "programmatic";

type Modifiers = {
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
};

export type KeyBinding = Modifiers & {
  kind: "key";
  platform: "desktop" | "mac";
  key: string;
  code?: string;
  scope?: ActionScope;
};

export type SurfaceBinding = {
  kind: "surface";
  platform: InputPlatform;
  surface: string;
  scope?: ActionScope;
};

export type ActionBinding = KeyBinding | SurfaceBinding;

export type ActionRuntime = {
  source: InputSource;
  platform: InputPlatform;
  hasWorkspace: boolean;
  runCommand: (id: string) => void;
};

export type ActionDefinition = {
  id: ActionId;
  title: string;
  category: string;
  scope: ActionScope;
  platforms: InputPlatform[];
  defaultBindings: ActionBinding[];
  run: (runtime: ActionRuntime) => void | Promise<void>;
  enabled?: (runtime: ActionRuntime) => boolean;
  allowInEditable?: boolean;
  repeatable?: boolean;
};

export type BindingConflict = {
  binding: ActionBinding;
  actionIds: ActionId[];
};