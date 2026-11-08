import { describe, expect, it } from "vitest";
import {
  createPluginHost,
  validatePluginManifest,
} from "../../../../src/kernel/sdk";
import { hasUiRenderer } from "../../../../src/kernel/sdk";
import { importPlugin } from "../../../../src/plugins/import/index";
import { importFeature } from "../../../../src/plugins/import/manifest";

describe("import plugin", () => {
  it("validates and registers the document renderer", async () => {
    expect(validatePluginManifest(importFeature)).toEqual([]);
    const host = createPluginHost([
      {
        manifest: importFeature,
        createModule: () => importPlugin,
      },
    ]);

    await host.start();
    expect(host.getContributions("commands")).toHaveLength(0);
    expect(hasUiRenderer("document.importedView")).toBe(true);
    await host.stop();
    expect(hasUiRenderer("document.importedView")).toBe(false);
  });
});
