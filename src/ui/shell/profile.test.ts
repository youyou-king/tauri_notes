import { describe, expect, it } from "vitest";
import { resolveShellProfile } from "./profile";

describe("shell profile", () => {
  it("resolves mobile, tablet and desktop breakpoints", () => {
    expect(resolveShellProfile(600)).toMatchObject({
      kind: "mobile",
      layout: "stack",
      touchPreferred: true,
    });
    expect(resolveShellProfile(900)).toMatchObject({
      kind: "tablet",
      layout: "dock",
      touchPreferred: true,
    });
    expect(resolveShellProfile(1400)).toMatchObject({
      kind: "desktop",
      layout: "dock",
      touchPreferred: false,
    });
  });
});
