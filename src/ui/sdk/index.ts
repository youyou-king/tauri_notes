export { useWorkspacePort, WorkspaceBridge } from "./workspace";
export type { WorkspacePort } from "./workspace";
export {
  Button,
  confirmDialog,
  Dialog,
  Field,
  Icon,
  IconButton,
  message,
  ModalSurface,
  PanelHeader,
  PanelIcon,
  PanelShell,
  renderMarkdownHtml,
  Select,
  StateView,
  SurfaceHeader,
  TextInput,
  usePanelContext,
} from "./primitives";
export {
  ToolbarButton,
  ToolbarMenu,
  useToolbarPopover,
} from "../toolbar/ToolbarMenu";
export { useEditorSnapshot } from "../editor/useEditorSnapshot";
export {
  setPanelStatus,
  type PanelLifecycle,
} from "./panelStatus";
export {
  openSettings,
  SETTINGS_OPEN_EVENT,
} from "../settings/settingsEvents";
export {
  isPluginDisabled,
  readDisabledPlugins,
  setPluginDisabled,
  usePluginContributions,
  usePluginEntries,
  usePluginFailures,
  usePluginHost,
  usePluginReady,
} from "./plugins";
export {
  CUSTOM_THEMES_KEY,
  ThemeProvider,
  useTheme,
  type ThemeManifest,
  type ThemeMode,
  type ThemeSelection,
} from "./theme";

export { shellActions } from "../shell/shellActions";
