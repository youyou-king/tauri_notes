import type { ShellProfile } from "../ui/shell/profile";
import type { Runtime } from "./contracts";
import { createDesktopRuntime } from "./createDesktopRuntime";
import { createMobileRuntime } from "./createMobileRuntime";

/**
 * Composition root. This is the only place that maps a layout profile to a
 * concrete shell; the rest of the application receives a Runtime.
 */
export function createRuntime(profile: ShellProfile): Runtime {
  return profile.kind === "mobile"
    ? createMobileRuntime(profile)
    : createDesktopRuntime(profile);
}