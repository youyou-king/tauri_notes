import type { Runtime } from "./contracts";
import type { ShellProfile } from "../ui/shell/profile";
import { DesktopShell } from "../ui/shell/DesktopShell";

export function createDesktopRuntime(profile: ShellProfile): Runtime {
  return {
    Shell: DesktopShell,
    shellKind: profile.kind,
    layout: profile.layout,
  };
}