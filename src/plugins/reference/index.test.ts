import { describe, expect, it } from "vitest";
import {
  createPluginHost,
  validatePluginManifest,
} from "../../kernel/sdk";
import { referencePlugin } from "./index";
import { referenceFeature } from "./manifest";

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
    expect(host.getContributions("settingsSections")[0]?.id).toBe(
      "reference.settings",
    );
    await host.stop();
  });
});
