import { describe, expect, it } from "vitest";
import {
  createPluginHost,
  validatePluginManifest,
} from "../../../../src/kernel/sdk";
import { hasUiRenderer } from "../../../../src/kernel/sdk";
import { viewportPlugin } from "../../../../src/plugins/viewport/index";
import { viewportFeature } from "../../../../src/plugins/viewport/manifest";

describe("viewport plugin", () => {
  it("validates and registers the pick command", async () => {
    expect(validatePluginManifest(viewportFeature)).toEqual([]);
    const host = createPluginHost([
      {
        manifest: viewportFeature,
        createModule: () => viewportPlugin,
      },
    ]);

    await host.start();
    expect(host.getContributions("commands")[0]?.id).toBe("viewport.pick");
    expect(hasUiRenderer("viewport.selection")).toBe(true);
    await host.stop();
    expect(hasUiRenderer("viewport.selection")).toBe(false);
  });
});
