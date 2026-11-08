import { describe, expect, it } from "vitest";
import { createPluginHost } from "../../../../src/kernel/sdk";
import { themePlugin } from "../../../../src/plugins/theme/index";
import { themeFeature } from "../../../../src/plugins/theme/manifest";

describe("theme plugin", () => {
  it("activates and registers all declared contributions", async () => {
    const host = createPluginHost([
      {
        manifest: themeFeature,
        createModule: () => themePlugin,
      },
    ]);

    await host.start();

    expect(
      host.getContributions("commands").map((item) => item.id),
    ).toEqual(["theme.open", "theme.apply"]);
    expect(host.getContributions("settingsSections")).toEqual([]);
    expect(host.getContributions("appearancePacks")[0]?.id).toBe(
      "theme.builtin",
    );

    await host.stop();
  });
});
