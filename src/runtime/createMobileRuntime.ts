import type { Runtime } from "./contracts";
import type { ShellProfile } from "../ui/shell/profile";
import { MobileRuntimeShell } from "../ui/shell/MobileRuntimeShell";
import { createMobileLibrary } from "./services/library";
import { createMobileDialogs } from "./services/dialogs";
import { createMobileDocumentActions } from "./services/documentActions";
import { createWorkspacePresenter } from "./services/workspacePresenter";

export function createMobileRuntime(profile: ShellProfile): Runtime {
  return {
    Shell: MobileRuntimeShell,
    shellKind: profile.kind,
    layout: profile.layout,
    services: {
      library: createMobileLibrary(),
      dialogs: createMobileDialogs(),
      documentActions: createMobileDocumentActions(),
      workspacePresenter: createWorkspacePresenter(),
    },
  };
}