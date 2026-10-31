import type { CoreCapability } from "../kernel/sdk";

/**
 * Build-level capability policy. A plugin only receives the capabilities
 * listed here, even if its manifest asks for more. New plugins must be added
 * explicitly before they can use host services.
 */
export const PLUGIN_CAPABILITY_POLICY: Readonly<
  Record<string, readonly CoreCapability[]>
> = {
  board: ["board.read", "board.write", "ui.panel", "ui.command"],
  help: ["ui.command", "ui.toolbar"],
  import: [
    "document.read",
    "document.write",
    "ui.panel",
    "board.read",
    "board.write",
    "fs.read",
    "fs.write",
  ],
  reference: [
    "document.read",
    "ui.settings",
    "ui.command",
    "reference.read",
    "reference.write",
  ],
  search: ["document.read", "ui.command", "ui.panel"],
  theme: [
    "appearance.read",
    "appearance.write",
    "ui.toolbar",
    "ui.settings",
    "ui.command",
  ],
  viewport: [
    "document.read",
    "ui.panel",
    "ui.command",
    "document.write",
  ],
};
