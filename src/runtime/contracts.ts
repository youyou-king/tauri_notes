import type { ComponentProps, ComponentType, RefObject } from "react";
import type DockWorkspace from "../components/DockWorkspace";
import type { DockWorkspaceHandle } from "../components/DockWorkspace";
import type { DialogPort } from "../application/ports/dialogPort";
import type { DocumentActionsPort } from "../application/ports/documentActionsPort";
import type { LibraryPort } from "../application/ports/libraryPort";
import type { WorkspacePresenter } from "../application/ports/workspacePresenterPort";
import type { NavigationPort } from "../application/ports/navigationPort";
import type { LifecyclePort } from "../application/ports/lifecyclePort";
import type { SharePort } from "../application/ports/sharePort";

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
  onOpenWorkspace: () => Promise<void> | void;
  onCreateKnowledgeBase: () => Promise<void> | void;
  onOpenWorkspacePath: (path: string) => Promise<void> | void;
};

export type ShellKind = "desktop" | "tablet" | "mobile";

export type RuntimeServices = {
  library: LibraryPort;
  dialogs: DialogPort;
  documentActions: DocumentActionsPort;
  workspacePresenter: WorkspacePresenter;
  navigation: NavigationPort;
  lifecycle: LifecyclePort;
  share: SharePort;
};

export type Runtime = {
  Shell: ComponentType<ShellProps>;
  shellKind: ShellKind;
  layout: "dock" | "stack";
  services: RuntimeServices;
};