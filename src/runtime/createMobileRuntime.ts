import type { Runtime } from "./contracts";
import type { ShellProfile } from "../ui/shell/profile";
import { MobileRuntimeShell } from "../ui/shell/MobileRuntimeShell";

export function createMobileRuntime(profile: ShellProfile): Runtime {
  return {
    Shell: MobileRuntimeShell,
    shellKind: profile.kind,
    layout: profile.layout,
  };
}