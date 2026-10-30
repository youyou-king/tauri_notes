import { describe, expect, it } from "vitest";
import {
  createPluginHost,
  validatePluginManifest,
} from "../../kernel/sdk";
import { managerPlugin } from "./index";
import { managerFeature } from "./manifest";

describe("plugin manager", () => {
  it("registers the plugin settings section", async () => {
    expect(validatePluginManifest(managerFeature)).toEqual([]);
    const host = createPluginHost([
      {
        manifest: managerFeature,
        createModule: () => managerPlugin,
      },
    ]);
    await host.start();
    expect(host.getContributions("settingsSections")[0]?.id).toBe(
      "plugin.manager",
    );
    await host.stop();
  });
});
