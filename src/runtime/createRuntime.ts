import type { ShellProfile } from "../ui/shell/profile";
import type { Runtime } from "./contracts";
import { createDesktopRuntime } from "./createDesktopRuntime";
import { createMobileRuntime } from "./createMobileRuntime";
import { resolveHostPlatform, type HostPlatform } from "./hostPlatform";

/**
 * Composition root. A mobile host always uses the mobile runtime, even when
 * its tablet viewport is wider than the desktop breakpoint. Width remains a
 * layout concern inside the mobile shell; it does not select desktop
 * Dockview or desktop window chrome.
 */
export function createRuntime(
  profile: ShellProfile,
  hostPlatform: HostPlatform = resolveHostPlatform(),
): Runtime {
  if (hostPlatform === "android" || hostPlatform === "ios") {
    return createMobileRuntime({
      ...profile,
      kind: "mobile",
      layout: "stack",
      touchPreferred: true,
    });
  }
  return profile.kind === "mobile"
    ? createMobileRuntime(profile)
    : createDesktopRuntime(profile);
}