import type { Runtime } from "./contracts";
import type { ShellProfile } from "../ui/shell/profile";
import { MobileRuntimeShell } from "../ui/shell/MobileRuntimeShell";
import { createMobileLibrary } from "./services/library";
import { createAppDialogs } from "./services/dialogs";
import { createMobileDocumentActions } from "./services/documentActions";
import { createWorkspacePresenter } from "./services/workspacePresenter";
import { createWebLifecycle } from "./services/lifecycle";
import { createMobileShare } from "./services/share";
import { createMobileNavigation } from "./services/navigation";

export function createMobileRuntime(profile: ShellProfile): Runtime {
  return {
    Shell: MobileRuntimeShell,
    shellKind: profile.kind,
    layout: profile.layout,
    services: {
      library: createMobileLibrary(),
      dialogs: createAppDialogs(),
      documentActions: createMobileDocumentActions(),
      workspacePresenter: createWorkspacePresenter(),
      navigation: createMobileNavigation(),
      lifecycle: createWebLifecycle(),
      share: createMobileShare(),
    },
  };
}