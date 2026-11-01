import { describe, expect, it } from "vitest";
import type { ShellProfile } from "../ui/shell/profile";
import { createRuntime } from "./createRuntime";
import { DesktopShell } from "../ui/shell/DesktopShell";
import { MobileRuntimeShell } from "../ui/shell/MobileRuntimeShell";

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
});