import type { ComponentProps, ComponentType, RefObject } from "react";
import type DockWorkspace from "../components/DockWorkspace";
import type { DockWorkspaceHandle } from "../components/DockWorkspace";
import type { DialogPort } from "../application/ports/dialogPort";
import type { DocumentActionsPort } from "../application/ports/documentActionsPort";
import type { LibraryPort } from "../application/ports/libraryPort";

/**
 * Props shared by every shell. The desktop implementation consumes the full
 * DockWorkspace contract; the mobile implementation only reads the subset it
 * renders. Shells must not contain platform checks; composition happens in
 * src/runtime.
 */
export type ShellProps = ComponentProps<typeof DockWorkspace> & {
  pluginReady: boolean;
  backend: string;
  busy: boolean;
  error: string | null;
  runCommand: (id: string) => void;
  dockRef: RefObject<DockWorkspaceHandle | null>;
};

export type ShellKind = "desktop" | "tablet" | "mobile";

export type RuntimeServices = {
  library: LibraryPort;
  dialogs: DialogPort;
  documentActions: DocumentActionsPort;
};

export type Runtime = {
  Shell: ComponentType<ShellProps>;
  shellKind: ShellKind;
  layout: "dock" | "stack";
  services: RuntimeServices;
};