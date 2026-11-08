import { describe, expect, it } from "vitest";
import type { ShellProfile } from "../../../src/ui/shell/profile";
import { createRuntime } from "../../../src/runtime/createRuntime";
import { DesktopShell } from "../../../src/ui/shell/DesktopShell";
import { MobileRuntimeShell } from "../../../src/ui/shell/MobileRuntimeShell";

const profile = (
  kind: ShellProfile["kind"],
  layout: ShellProfile["layout"],
): ShellProfile => ({
  kind,
  layout,
  touchPreferred: kind !== "desktop",
  minWidth: kind === "desktop" ? 1400 : 390,
});

describe("runtime composition root", () => {
  it("selects the mobile shell for a stack layout", () => {
    const runtime = createRuntime(profile("mobile", "stack"));
    expect(runtime.Shell).toBe(MobileRuntimeShell);
    expect(runtime.shellKind).toBe("mobile");
  });

  it("selects the desktop shell for tablet and desktop layouts", () => {
    expect(createRuntime(profile("tablet", "dock")).Shell).toBe(
      DesktopShell,
    );
    expect(createRuntime(profile("desktop", "dock")).Shell).toBe(
      DesktopShell,
    );
  });

  it("keeps Android tablets on the mobile runtime", () => {
    const runtime = createRuntime(profile("tablet", "dock"), "android");
    expect(runtime.Shell).toBe(MobileRuntimeShell);
    expect(runtime.shellKind).toBe("mobile");
    expect(runtime.layout).toBe("stack");
  });
});