import { describe, expect, it } from "vitest";
import { validatePluginManifest } from "../../../../src/kernel/sdk";
import { themeFeature } from "../../../../src/plugins/theme/manifest";

describe("theme feature manifest", () => {
  it("is a valid feature plugin manifest", () => {
    expect(validatePluginManifest(themeFeature)).toEqual([]);
    expect(themeFeature.provides).toContain("theme");
    expect(themeFeature.contributes?.appearancePacks).toContain(
      "theme.builtin",
    );
  });
});
