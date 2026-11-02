import type { Runtime } from "./contracts";
import type { ShellProfile } from "../ui/shell/profile";
import { DesktopShell } from "../ui/shell/DesktopShell";
import { createDesktopLibrary } from "./services/library";
import { createDesktopDialogs } from "./services/dialogs";
import { createDesktopDocumentActions } from "./services/documentActions";
import { createWorkspacePresenter } from "./services/workspacePresenter";
import { createWebLifecycle } from "./services/lifecycle";
import { createDesktopShare } from "./services/share";
import { createDesktopNavigation } from "./services/navigation";

export function createDesktopRuntime(profile: ShellProfile): Runtime {
  return {
    Shell: DesktopShell,
    shellKind: profile.kind,
    layout: profile.layout,
    services: {
      library: createDesktopLibrary(),
      dialogs: createDesktopDialogs(),
      documentActions: createDesktopDocumentActions(),
      workspacePresenter: createWorkspacePresenter(),
      navigation: createDesktopNavigation(),
      lifecycle: createWebLifecycle(),
      share: createDesktopShare(),
    },
  };
}