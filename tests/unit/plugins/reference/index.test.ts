import { describe, expect, it } from "vitest";
import {
  createPluginHost,
  validatePluginManifest,
} from "../../../../src/kernel/sdk";
import { referencePlugin } from "../../../../src/plugins/reference/index";
import { referenceFeature } from "../../../../src/plugins/reference/manifest";

describe("reference plugin", () => {
  it("validates and registers the resolve command", async () => {
    expect(validatePluginManifest(referenceFeature)).toEqual([]);
    const host = createPluginHost([
      {
        manifest: referenceFeature,
        createModule: () => referencePlugin,
      },
    ]);

    await host.start();
    expect(host.getContributions("commands")[0]?.id).toBe(
      "reference.resolve",
    );
    expect(host.getContributions("settingsSections")).toEqual([]);
    await host.stop();
  });
});
