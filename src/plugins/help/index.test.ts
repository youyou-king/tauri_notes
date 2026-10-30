import { describe, expect, it } from "vitest";
import {
  createPluginHost,
  validatePluginManifest,
} from "../../kernel/sdk";
import { helpPlugin } from "./index";
import { helpFeature } from "./manifest";

describe("help plugin", () => {
  it("validates and registers the help command", async () => {
    expect(validatePluginManifest(helpFeature)).toEqual([]);
    const host = createPluginHost([
      {
        manifest: helpFeature,
        createModule: () => helpPlugin,
      },
    ]);

    await host.start();
    expect(host.getContributions("commands")[0]?.id).toBe("help.open");
    expect(host.getContributions("toolbarItems")[0]?.id).toBe(
      "help.button",
    );
    await host.stop();
  });
});
