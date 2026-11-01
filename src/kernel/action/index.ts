export { DEFAULT_BINDINGS, resolveInputPlatform } from "./bindings";
export {
  applyKeymap,
  type KeymapDocument,
  type KeymapRecord,
} from "./keymap";
export {
  formatBinding,
  shortcutForAction,
} from "./labels";
export {
  bindingsForPlatform,
  clearActionsForTests,
  findBindingConflicts,
  getAction,
  listActions,
  registerAction,
  unregisterAction,
} from "./registry";
export {
  createInputRouter,
  isEditableTarget,
  type InputRouterOptions,
  type InputRouterRuntime,
} from "./router";
export type {
  ActionBinding,
  ActionDefinition,
  ActionId,
  ActionRuntime,
  ActionScope,
  BindingConflict,
  InputPlatform,
  InputSource,
  KeyBinding,
  SurfaceBinding,
} from "./types";