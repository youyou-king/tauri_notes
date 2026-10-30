import { describe, expect, it } from "vitest";
import {
  createPluginHost,
  validatePluginManifest,
} from "../../kernel/sdk";
import { searchPlugin } from "./index";
import { searchFeature } from "./manifest";

describe("search plugin", () => {
  it("validates and registers the open command", async () => {
    expect(validatePluginManifest(searchFeature)).toEqual([]);
    const host = createPluginHost([
      {
        manifest: searchFeature,
        createModule: () => searchPlugin,
      },
    ]);

    await host.start();
    expect(host.getContributions("commands")[0]?.id).toBe("search.open");
    await host.stop();
  });
});
